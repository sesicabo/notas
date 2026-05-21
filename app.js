// --- IMPORTAÇÕES DO FIREBASE (Via CDN para uso direto no navegador) ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, doc, getDoc, runTransaction } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// --- CONFIGURAÇÃO DO FIREBASE ---
const firebaseConfig = {
    apiKey: "AIzaSyCVv-O51F9iZDSXKzbINQUFAb-ZlFKlFWM",
    authDomain: "platnota2b.firebaseapp.com",
    projectId: "platnota2b",
    storageBucket: "platnota2b.firebasestorage.app",
    messagingSenderId: "488178786002",
    appId: "1:488178786002:web:7a8dd6457f5fe5d43c970b"
};

// Inicializar Aplicativo e Banco de Dados
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --- ESTADOS DA APLICAÇÃO ---
let currentLevel = '';
let currentGrade = '';
let activities = []; 
let students = []; 

const seriesMap = {
    'fund1': ['1º Ano', '2º Ano', '3º Ano', '4º Ano', '5º Ano'],
    'fund2': ['6º Ano', '7º Ano', '8º Ano', '9º Ano'],
    'medio': ['1ª Série', '2ª Série', '3ª Série']
};

// --- AUTENTICAÇÃO ---
document.getElementById('login-form').addEventListener('submit', function(e) {
    e.preventDefault();
    document.getElementById('login-screen').classList.remove('active');
    document.getElementById('dashboard-screen').classList.add('active');
});

window.logout = function() {
    document.getElementById('dashboard-screen').classList.remove('active');
    document.getElementById('login-screen').classList.add('active');
};

// --- NAVEGAÇÃO E SELEÇÃO ---
window.updateGrades = function() {
    const levelSelect = document.getElementById('level-select');
    const gradeSelect = document.getElementById('grade-select');
    
    currentLevel = levelSelect.value;
    gradeSelect.innerHTML = '<option value="">Selecione a Série...</option>';
    
    if (currentLevel && seriesMap[currentLevel]) {
        seriesMap[currentLevel].forEach(serie => {
            const opt = document.createElement('option');
            opt.value = serie;
            opt.textContent = serie;
            gradeSelect.appendChild(opt);
        });
        gradeSelect.disabled = false;
    } else {
        gradeSelect.disabled = true;
        hideTable();
    }
};

window.loadClassData = async function() {
    const gradeSelect = document.getElementById('grade-select');
    currentGrade = gradeSelect.value;

    if (!currentGrade) {
        hideTable();
        return;
    }

    await fetchFromDatabaseSecurely(currentLevel, currentGrade);
    
    document.getElementById('management-section').classList.remove('hidden');
    document.getElementById('table-container').classList.remove('hidden');
    
    renderTable();
};

function hideTable() {
    document.getElementById('management-section').classList.add('hidden');
    document.getElementById('table-container').classList.add('hidden');
}

// --- DINÂMICA DA TABELA ---
window.addActivityColumn = function() {
    const actId = `av_${Date.now()}`;
    activities.push({ id: actId, name: `Avaliação ${activities.length + 1}`, weight: 100 });
    renderTable();
};

window.updateActivityName = function(id, value) {
    const act = activities.find(a => a.id === id);
    if(act) act.name = value;
};

window.updateActivityWeight = function(id, value) {
    const act = activities.find(a => a.id === id);
    if(act) act.weight = parseFloat(value) || 0;
};

window.addStudent = function() {
    const name = prompt("Nome completo do aluno:");
    if (name && name.trim() !== "") {
        students.push({ id: Date.now(), name: name, grades: {}, recup: null });
        renderTable();
    }
};

window.removeStudent = function(studentId) {
    if(confirm("Tem certeza que deseja excluir este aluno? Os dados serão perdidos e a ação afetará o boletim do aluno.")) {
        students = students.filter(s => s.id !== studentId);
        renderTable();
    }
};

function renderTable() {
    const headerRow = document.getElementById('table-header');
    const tbody = document.getElementById('table-body');
    
    headerRow.innerHTML = `<th>Aluno</th>`;
    
    activities.forEach(act => {
        headerRow.innerHTML += `
            <th class="activity-header">
                <input type="text" value="${act.name}" onchange="updateActivityName('${act.id}', this.value)" placeholder="Nome">
                <br>
                <input type="number" value="${act.weight}" onchange="updateActivityWeight('${act.id}', this.value)" placeholder="Peso %" min="0" max="100"> %
            </th>
        `;
    });

    headerRow.innerHTML += `
        <th>Média Bimestral</th>
        <th>Recuperação</th>
        <th>Média Final</th>
        <th>Ações</th>
    `;

    tbody.innerHTML = '';
    students.forEach(student => {
        let row = `<tr><td>${student.name}</td>`;
        
        activities.forEach(act => {
            const val = student.grades[act.id] !== undefined ? student.grades[act.id] : '';
            row += `<td><input type="number" step="0.1" min="0" max="100" value="${val}" oninput="updateGrade(${student.id}, '${act.id}', this.value)"></td>`;
        });

        const medias = calculateAverages(student);
        const needsRecup = medias.bimestral < 60 && activities.length > 0;

        row += `
            <td class="readonly-cell">${medias.bimestral.toFixed(1)}</td>
            <td>
                <input type="number" step="0.1" min="0" max="100" 
                    value="${student.recup !== null ? student.recup : ''}" 
                    oninput="updateRecup(${student.id}, this.value)" 
                    ${needsRecup ? '' : 'disabled'}>
            </td>
            <td class="readonly-cell">${medias.final.toFixed(1)}</td>
            <td><button class="btn-danger" onclick="removeStudent(${student.id})">Excluir</button></td>
        </tr>`;
        
        tbody.innerHTML += row;
    });
}

// --- LÓGICA MATEMÁTICA ---
window.updateGrade = function(studentId, activityId, value) {
    const student = students.find(s => s.id === studentId);
    if(value === "") {
        delete student.grades[activityId];
    } else {
        student.grades[activityId] = parseFloat(value);
    }
    renderTable();
};

window.updateRecup = function(studentId, value) {
    const student = students.find(s => s.id === studentId);
    student.recup = value !== '' ? parseFloat(value) : null;
    renderTable();
};

function calculateAverages(student) {
    if (activities.length === 0) return { bimestral: 0, final: 0 };

    let sum = 0;
    let count = 0;

    activities.forEach(act => {
        if (student.grades[act.id] !== undefined && !isNaN(student.grades[act.id])) {
            sum += student.grades[act.id];
            count++;
        }
    });

    const mediaBimestral = count > 0 ? (sum / count) : 0;
    
    let mediaFinal = mediaBimestral;
    if (mediaBimestral < 60 && student.recup !== null && !isNaN(student.recup)) {
        mediaFinal = student.recup > mediaBimestral ? student.recup : mediaBimestral;
    }

    return { bimestral: mediaBimestral, final: mediaFinal };
}

// --- BANCO DE DADOS FIREBASE (SEGURO E CONCORRENTE) ---
async function fetchFromDatabaseSecurely(level, grade) {
    console.log(`Buscando dados seguros na nuvem para ${grade}...`);
    
    try {
        const docRef = doc(db, "classes", `${level}_${grade}`);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            students = data.students || [];
            activities = data.activities || [];
        } else {
            students = [];
            activities = [];
        }
    } catch (error) {
        console.error("Erro ao buscar dados: ", error);
        alert("Falha ao carregar a turma. Verifique sua conexão.");
    }
}

window.saveDataSecurely = async function() {
    const btn = document.getElementById('btn-save');
    const originalText = btn.textContent;
    
    try {
        btn.textContent = "Salvando na Nuvem...";
        btn.disabled = true;
        
        const docRef = doc(db, "classes", `${currentLevel}_${currentGrade}`);
        
        // TRANSAÇÃO ACID: Evita colisão se dois professores salvarem juntos
        await runTransaction(db, async (transaction) => {
            transaction.set(docRef, { 
                students: students,
                activities: activities,
                lastUpdated: new Date().toISOString()
            }, { merge: true });
        });
        
        alert("Notas salvas e protegidas na Nuvem com sucesso!");
    } catch (error) {
        console.error("Erro na transação: ", error);
        alert("Erro de conexão com o banco de dados. Nenhuma nota foi perdida, aguarde um momento e tente novamente.");
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
};

// --- GERAÇÃO DE PDF ---
window.generateBoletimPDF = function() {
    const element = document.getElementById('grades-table').cloneNode(true);
    
    // Remove a coluna de ações e inputs, transformando em documento estático 
    element.querySelectorAll('th:last-child, td:last-child').forEach(el => el.remove());
    element.querySelectorAll('input').forEach(input => {
        const span = document.createElement('span');
        span.textContent = input.value || "-";
        input.parentNode.replaceChild(span, input);
    });

    const opt = {
        margin:       10,
        filename:     `Boletim_${currentGrade.replace(' ', '_')}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2 },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'landscape' }
    };

    html2pdf().set(opt).from(element).save();
};
