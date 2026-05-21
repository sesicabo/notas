import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, runTransaction } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCVv-O51F9iZDSXKzbINQUFAb-ZlFKlFWM",
    authDomain: "platnota2b.firebaseapp.com",
    projectId: "platnota2b",
    storageBucket: "platnota2b.firebasestorage.app",
    messagingSenderId: "488178786002",
    appId: "1:488178786002:web:7a8dd6457f5fe5d43c970b"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ESTADOS DA APLICAÇÃO
let currentLevel = '';
let currentGrade = '';
let currentTurma = '';
let activities = []; 
let students = []; 
let escolaConfig = {}; // Armazena a estrutura de turmas salva no Firebase

const seriesMap = {
    'fund1': ['1º Ano', '2º Ano', '3º Ano', '4º Ano', '5º Ano'],
    'fund2': ['6º Ano', '7º Ano', '8º Ano', '9º Ano'],
    'medio': ['1ª Série', '2ª Série', '3ª Série']
};

// --- AUTENTICAÇÃO ---
document.getElementById('login-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    document.getElementById('login-screen').classList.remove('active');
    document.getElementById('dashboard-screen').classList.add('active');
    
    // Ao logar, busca a estrutura de turmas da escola
    try {
        const configRef = doc(db, "config", "estrutura_escola");
        const configSnap = await getDoc(configRef);
        if (configSnap.exists()) {
            escolaConfig = configSnap.data().turmasMap || {};
        }
    } catch(err) {
        console.warn("Criando estrutura inicial do banco de dados...");
    }
});

window.logout = function() {
    document.getElementById('dashboard-screen').classList.remove('active');
    document.getElementById('login-screen').classList.add('active');
    hideTable();
};

// --- NAVEGAÇÃO E SELEÇÃO ---
window.updateGrades = function() {
    currentLevel = document.getElementById('level-select').value;
    const gradeSelect = document.getElementById('grade-select');
    
    gradeSelect.innerHTML = '<option value="">2. Selecione a Série...</option>';
    document.getElementById('turma-select').innerHTML = '<option value="">3. Selecione a Turma...</option>';
    document.getElementById('turma-select').disabled = true;
    hideTurmaControls();
    hideTable();
    
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
    }
};

window.updateTurmas = function() {
    currentGrade = document.getElementById('grade-select').value;
    const turmaSelect = document.getElementById('turma-select');
    
    turmaSelect.innerHTML = '<option value="">3. Selecione a Turma...</option>';
    hideTable();
    
    if (currentGrade) {
        const key = `${currentLevel}_${currentGrade}`;
        const turmasDisponiveis = escolaConfig[key] || [];
        
        turmasDisponiveis.forEach(t => {
            const opt = document.createElement('option');
            opt.value = t;
            opt.textContent = `Turma ${t}`;
            turmaSelect.appendChild(opt);
        });
        
        turmaSelect.disabled = false;
        showTurmaControls();
    } else {
        turmaSelect.disabled = true;
        hideTurmaControls();
    }
};

window.addTurma = async function() {
    const nomeTurma = prompt("Digite a identificação da Turma (Ex: A, B, Única):");
    if (!nomeTurma || nomeTurma.trim() === "") return;
    
    const key = `${currentLevel}_${currentGrade}`;
    if (!escolaConfig[key]) escolaConfig[key] = [];
    
    if (escolaConfig[key].includes(nomeTurma.toUpperCase())) {
        alert("Essa turma já existe nesta série!");
        return;
    }
    
    escolaConfig[key].push(nomeTurma.toUpperCase());
    
    // Salva a nova turma na estrutura do Firebase
    await setDoc(doc(db, "config", "estrutura_escola"), { turmasMap: escolaConfig }, { merge: true });
    
    updateTurmas(); // Atualiza o dropdown
    document.getElementById('turma-select').value = nomeTurma.toUpperCase();
    loadClassData();
};

window.deleteTurma = async function() {
    const turmaSelect = document.getElementById('turma-select');
    const turmaSelecionada = turmaSelect.value;
    
    if (!turmaSelecionada) return alert("Selecione uma turma para excluir.");
    
    if (confirm(`Atenção: Tem certeza que deseja excluir a Turma ${turmaSelecionada}? Todos os dados dos alunos desta turma serão perdidos permanentemente.`)) {
        const key = `${currentLevel}_${currentGrade}`;
        escolaConfig[key] = escolaConfig[key].filter(t => t !== turmaSelecionada);
        
        await setDoc(doc(db, "config", "estrutura_escola"), { turmasMap: escolaConfig }, { merge: true });
        
        updateTurmas();
        hideTable();
    }
};

window.loadClassData = async function() {
    currentTurma = document.getElementById('turma-select').value;
    if (!currentTurma) {
        hideTable();
        return;
    }
    await fetchFromDatabaseSecurely(currentLevel, currentGrade, currentTurma);
    document.getElementById('management-section').classList.remove('hidden');
    document.getElementById('table-container').classList.remove('hidden');
    renderTable();
};

function showTurmaControls() {
    document.getElementById('btn-add-turma').classList.remove('hidden');
    document.getElementById('btn-del-turma').classList.remove('hidden');
}

function hideTurmaControls() {
    document.getElementById('btn-add-turma').classList.add('hidden');
    document.getElementById('btn-del-turma').classList.add('hidden');
}

function hideTable() {
    document.getElementById('management-section').classList.add('hidden');
    document.getElementById('table-container').classList.add('hidden');
}

// --- DINÂMICA DA TABELA E NOTAS ---
window.addActivityColumn = function() {
    const actId = `av_${Date.now()}`;
    // Se for médio, peso padrão 100%. Se for fundamental, não tem peso percentual visível na regra de negócio atual, mas mantemos o objeto.
    activities.push({ id: actId, name: `Avaliação ${activities.length + 1}`, weight: 100 });
    renderTable();
};

window.updateActivityName = function(id, value) {
    const act = activities.find(a => a.id === id);
    if(act) act.name = value;
};

window.addStudent = function() {
    const name = prompt("Nome completo do aluno:");
    if (name && name.trim() !== "") {
        students.push({ id: Date.now(), name: name, grades: {}, recup: null });
        renderTable();
    }
};

window.removeStudent = function(studentId) {
    if(confirm("Tem certeza que deseja excluir este aluno?")) {
        students = students.filter(s => s.id !== studentId);
        renderTable();
    }
};

function renderTable() {
    const headerRow = document.getElementById('table-header');
    const tbody = document.getElementById('table-body');
    const isMedio = currentLevel === 'medio';
    const maxValue = isMedio ? 100 : 10;
    
    headerRow.innerHTML = `<th>Aluno</th>`;
    
    activities.forEach(act => {
        headerRow.innerHTML += `
            <th class="activity-header">
                <input type="text" value="${act.name}" onchange="updateActivityName('${act.id}', this.value)" placeholder="Nome">
                <br>
                <span style="font-size: 12px; font-weight: normal;">(Máx: ${maxValue})</span>
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
            row += `<td><input type="number" step="0.1" min="0" max="${maxValue}" value="${val}" oninput="updateGrade(${student.id}, '${act.id}', this.value)"></td>`;
        });

        const medias = calculateAverages(student);
        const threshold = isMedio ? 60 : 6.0;
        const needsRecup = medias.bimestral < threshold && activities.length > 0;

        row += `
            <td class="readonly-cell">${medias.bimestral.toFixed(1)}</td>
            <td>
                <input type="number" step="0.1" min="0" max="${maxValue}" 
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

// --- LÓGICA DE CÁLCULO ESPECÍFICA POR NÍVEL ---
window.updateGrade = function(studentId, activityId, value) {
    const student = students.find(s => s.id === studentId);
    if(value === "") {
        delete student.grades[activityId];
    } else {
        // Trava de segurança para impedir notas acima do limite
        const max = currentLevel === 'medio' ? 100 : 10;
        let numVal = parseFloat(value);
        if (numVal > max) numVal = max;
        student.grades[activityId] = numVal;
    }
    renderTable();
};

window.updateRecup = function(studentId, value) {
    const student = students.find(s => s.id === studentId);
    if(value === "") {
        student.recup = null;
    } else {
        const max = currentLevel === 'medio' ? 100 : 10;
        let numVal = parseFloat(value);
        if (numVal > max) numVal = max;
        student.recup = numVal;
    }
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

    // Média Aritmética Simples
    const mediaBimestral = count > 0 ? (sum / count) : 0;
    
    // Regra de Aprovação e Recuperação baseada no Nível
    const isMedio = currentLevel === 'medio';
    const threshold = isMedio ? 60 : 6.0;
    
    let mediaFinal = mediaBimestral;
    if (mediaBimestral < threshold && student.recup !== null && !isNaN(student.recup)) {
        // A recuperação substitui a nota bimestral se for maior
        mediaFinal = student.recup > mediaBimestral ? student.recup : mediaBimestral;
    }

    return { bimestral: mediaBimestral, final: mediaFinal };
}

// --- BANCO DE DADOS FIREBASE ---
async function fetchFromDatabaseSecurely(level, grade, turma) {
    console.log(`Buscando turma ${turma} do ${grade} (${level})...`);
    try {
        const docId = `${level}_${grade}_${turma}`;
        const docRef = doc(db, "classes", docId);
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
        btn.textContent = "Salvando...";
        btn.disabled = true;
        
        const docId = `${currentLevel}_${currentGrade}_${currentTurma}`;
        const docRef = doc(db, "classes", docId);
        
        await runTransaction(db, async (transaction) => {
            transaction.set(docRef, { 
                students: students,
                activities: activities,
                lastUpdated: new Date().toISOString()
            }, { merge: true });
        });
        
        alert("Notas salvas e protegidas na Nuvem!");
    } catch (error) {
        console.error("Erro na transação: ", error);
        alert("Erro de conexão com o banco. Aguarde um momento e tente novamente.");
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
};

// --- GERAÇÃO DE PDF ---
window.generateBoletimPDF = function() {
    const element = document.getElementById('grades-table').cloneNode(true);
    
    element.querySelectorAll('th:last-child, td:last-child').forEach(el => el.remove());
    element.querySelectorAll('input').forEach(input => {
        const span = document.createElement('span');
        span.textContent = input.value || "-";
        input.parentNode.replaceChild(span, input);
    });

    const opt = {
        margin:       10,
        filename:     `Boletim_${currentGrade}_Turma_${currentTurma}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2 },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'landscape' }
    };

    html2pdf().set(opt).from(element).save();
};
