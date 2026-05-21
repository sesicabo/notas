// --- IMPORTAÇÕES DO FIREBASE (Via CDN oficial v10) ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc, runTransaction } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// --- CONFIGURAÇÃO DO SEU FIREBASE (PLATNOTA2B) ---
const firebaseConfig = {
    apiKey: "AIzaSyCVv-O51F9iZDSXKzbINQUFAb-ZlFKlFWM",
    authDomain: "platnota2b.firebaseapp.com",
    projectId: "platnota2b",
    storageBucket: "platnota2b.firebasestorage.app",
    messagingSenderId: "488178786002",
    appId: "1:488178786002:web:7a8dd6457f5fe5d43c970b"
};

// Inicializar Aplicativo e Firestore
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// --- ESTADOS DA APLICAÇÃO ---
let currentLevel = '';
let currentGrade = '';
let currentTurma = '';
let currentSubject = '';
let activities = {};  
let students = [];    
let subjects = [];    
let escolaConfig = {}; 

const seriesMap = {
    'fund1': ['1º Ano', '2º Ano', '3º Ano', '4º Ano', '5º Ano'],
    'fund2': ['6º Ano', '7º Ano', '8º Ano', '9º Ano'],
    'medio': ['1ª Série', '2ª Série', '3ª Série']
};

// --- AUTENTICAÇÃO SIMULADA ---
document.getElementById('login-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    document.getElementById('login-screen').classList.remove('active');
    document.getElementById('dashboard-screen').classList.add('active');
    
    try {
        const configRef = doc(db, "config", "estrutura_escola");
        const configSnap = await getDoc(configRef);
        if (configSnap.exists()) {
            escolaConfig = configSnap.data().turmasMap || {};
        }
    } catch(err) {
        console.warn("Inicializando árvore de turmas...");
    }
});

window.logout = function() {
    document.getElementById('dashboard-screen').classList.remove('active');
    document.getElementById('login-screen').classList.add('active');
    hideTable();
};

// --- NAVEGAÇÃO HIERÁRQUICA MULTINÍVEL ---
window.updateGrades = function() {
    currentLevel = document.getElementById('level-select').value;
    const gradeSelect = document.getElementById('grade-select');
    
    gradeSelect.innerHTML = '<option value="">2. Selecione a Série...</option>';
    document.getElementById('turma-select').innerHTML = '<option value="">3. Selecione a Turma...</option>';
    document.getElementById('turma-select').disabled = true;
    document.getElementById('subject-select').innerHTML = '<option value="">4. Selecione a Disciplina...</option>';
    document.getElementById('subject-select').disabled = true;
    
    hideTurmaControls();
    hideSubjectControls();
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
    document.getElementById('subject-select').innerHTML = '<option value="">4. Selecione a Disciplina...</option>';
    document.getElementById('subject-select').disabled = true;
    hideSubjectControls();
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

window.loadClassData = async function() {
    currentTurma = document.getElementById('turma-select').value;
    if (!currentTurma) {
        hideTable();
        hideSubjectControls();
        return;
    }
    
    await fetchFromDatabaseSecurely(currentLevel, currentGrade, currentTurma);
    showSubjectControls();
    updateSubjectsDropdown();
};

function updateSubjectsDropdown() {
    const subSelect = document.getElementById('subject-select');
    subSelect.innerHTML = '<option value="">4. Selecione a Disciplina...</option>';
    hideTable();
    
    subjects.forEach(sub => {
        const opt = document.createElement('option');
        opt.value = sub;
        opt.textContent = sub;
        subSelect.appendChild(opt);
    });
    subSelect.disabled = false;
}

window.loadSubjectData = function() {
    currentSubject = document.getElementById('subject-select').value;
    if (!currentSubject) {
        hideTable();
        return;
    }
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

function showSubjectControls() {
    document.getElementById('btn-add-sub').classList.remove('hidden');
    document.getElementById('btn-del-sub').classList.remove('hidden');
}

function hideSubjectControls() {
    document.getElementById('btn-add-sub').classList.add('hidden');
    document.getElementById('btn-del-sub').classList.add('hidden');
}

function hideTable() {
    document.getElementById('management-section').classList.add('hidden');
    document.getElementById('table-container').classList.add('hidden');
}

// --- CONTROLES DE JANELAS MODAIS INTERNAS ---
window.closeModal = function(modalId) {
    document.getElementById(modalId).classList.add('hidden');
};

window.openTurmaModal = function() {
    document.getElementById('input-turma-name').value = '';
    document.getElementById('modal-turma').classList.remove('hidden');
    document.getElementById('input-turma-name').focus();
};

window.confirmAddTurma = async function() {
    const nomeTurma = document.getElementById('input-turma-name').value;
    if (!nomeTurma || nomeTurma.trim() === "") return;
    
    const key = `${currentLevel}_${currentGrade}`;
    if (!escolaConfig[key]) escolaConfig[key] = [];
    
    const nomeFormatado = nomeTurma.trim().toUpperCase();
    if (escolaConfig[key].includes(nomeFormatado)) {
        alert("Esta turma já está cadastrada nesta série!");
        return;
    }
    
    escolaConfig[key].push(nomeFormatado);
    await setDoc(doc(db, "config", "estrutura_escola"), { turmasMap: escolaConfig }, { merge: true });
    
    updateTurmas(); 
    document.getElementById('turma-select').value = nomeFormatado;
    loadClassData();
    closeModal('modal-turma');
};

window.deleteTurma = async function() {
    const turmaSelect = document.getElementById('turma-select');
    const turmaSelecionada = turmaSelect.value;
    if (!turmaSelecionada) return alert("Selecione uma turma primeiro.");
    
    if (confirm(`CRÍTICO: Excluir a Turma ${turmaSelecionada} apagará permanentemente todos os diários de notas e históricos vinculados.`)) {
        const key = `${currentLevel}_${currentGrade}`;
        escolaConfig[key] = escolaConfig[key].filter(t => t !== turmaSelecionada);
        await setDoc(doc(db, "config", "estrutura_escola"), { turmasMap: escolaConfig }, { merge: true });
        updateTurmas();
        hideTable();
    }
};

window.openDisciplinaModal = function() {
    document.getElementById('input-disciplina-name').value = '';
    document.getElementById('modal-disciplina').classList.remove('hidden');
    document.getElementById('input-disciplina-name').focus();
};

window.confirmAddDisciplina = function() {
    const nomeSub = document.getElementById('input-disciplina-name').value;
    if (!nomeSub || nomeSub.trim() === "") return;
    
    const formatado = nomeSub.trim();
    if (subjects.includes(formatado)) {
        alert("Esta disciplina já existe nesta turma!");
        return;
    }
    
    subjects.push(formatado);
    activities[formatado] = []; 
    
    updateSubjectsDropdown();
    document.getElementById('subject-select').value = formatado;
    loadSubjectData();
    closeModal('modal-disciplina');
};

window.deleteDisciplina = function() {
    if (!currentSubject) return alert("Selecione uma disciplina para excluir.");
    if (confirm(`Tem certeza que deseja remover a disciplina de ${currentSubject}? Todas as avaliações desta matéria serão apagadas.`)) {
        subjects = subjects.filter(s => s !== currentSubject);
        delete activities[currentSubject];
        students.forEach(st => {
            if(st.grades[currentSubject]) delete st.grades[currentSubject];
            if(st.recup && st.recup[currentSubject]) delete st.recup[currentSubject];
        });
        updateSubjectsDropdown();
        hideTable();
    }
};

window.openStudentModal = function() {
    document.getElementById('input-student-name').value = '';
    document.getElementById('modal-student').classList.remove('hidden');
    document.getElementById('input-student-name').focus();
};

window.confirmAddStudent = function() {
    const name = document.getElementById('input-student-name').value;
    if (name && name.trim() !== "") {
        students.push({ id: Date.now(), name: name.trim(), grades: {}, recup: {} });
        renderTable();
        closeModal('modal-student');
    }
};

window.addActivityColumn = function() {
    if(!activities[currentSubject]) activities[currentSubject] = [];
    const actId = `av_${Date.now()}`;
    activities[currentSubject].push({ id: actId, name: `Avaliação ${activities[currentSubject].length + 1}`, weight: 100 });
    renderTable();
};

window.updateActivityName = function(id, value) {
    const act = activities[currentSubject].find(a => a.id === id);
    if(act) act.name = value;
};

window.removeStudent = function(studentId) {
    if(confirm("Deseja remover este aluno permanentemente da pauta da turma?")) {
        students = students.filter(s => s.id !== studentId);
        renderTable();
    }
};

// --- RENDERIZAÇÃO DA TABELA POR MATÉRIA ---
function renderTable() {
    const headerRow = document.getElementById('table-header');
    const tbody = document.getElementById('table-body');
    const isMedio = currentLevel === 'medio';
    const maxValue = isMedio ? 100 : 10;
    
    const subActivities = activities[currentSubject] || [];
    
    headerRow.innerHTML = `<th>Aluno</th>`;
    subActivities.forEach(act => {
        headerRow.innerHTML += `
            <th class="activity-header">
                <input type="text" value="${act.name}" onchange="updateActivityName('${act.id}', this.value)" placeholder="Nome">
                <br>
                <span style="font-size: 11px; font-weight: normal; color: rgba(255,255,255,0.6);">(Máx: ${maxValue}${isMedio ? '%' : ''})</span>
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
        let row = `<tr><td><strong>${student.name}</strong></td>`;
        
        subActivities.forEach(act => {
            const subGrades = student.grades[currentSubject] || {};
            const val = subGrades[act.id] !== undefined ? subGrades[act.id] : '';
            row += `<td><input type="number" step="0.1" min="0" max="${maxValue}" value="${val}" oninput="updateGrade(${student.id}, '${act.id}', this.value)"></td>`;
        });

        const medias = calculateAverages(student, currentSubject);
        const threshold = isMedio ? 60 : 6.0;
        const needsRecup = medias.bimestral < threshold && subActivities.length > 0;
        
        const recupMap = student.recup || {};
        const recupVal = recupMap[currentSubject] !== undefined && recupMap[currentSubject] !== null ? recupMap[currentSubject] : '';

        row += `
            <td class="readonly-cell">${medias.bimestral.toFixed(1)}${isMedio ? '%' : ''}</td>
            <td>
                <input type="number" step="0.1" min="0" max="${maxValue}" 
                    value="${recupVal}" 
                    oninput="updateRecup(${student.id}, this.value)" 
                    ${needsRecup ? '' : 'disabled'}>
            </td>
            <td class="readonly-cell">${medias.final.toFixed(1)}${isMedio ? '%' : ''}</td>
            <td class="actions-cell">
                <button class="btn-gold" onclick="generateIndividualPDF(${student.id})">📄 Boletim</button>
                <button class="btn-danger" onclick="removeStudent(${student.id})">✕</button>
            </td>
        </tr>`;
        
        tbody.innerHTML += row;
    });
}

// --- ATUALIZAÇÕES MATRICIAIS ---
window.updateGrade = function(studentId, activityId, value) {
    const student = students.find(s => s.id === studentId);
    if (!student.grades[currentSubject]) student.grades[currentSubject] = {};
    
    if(value === "") {
        delete student.grades[currentSubject][activityId];
    } else {
        const max = currentLevel === 'medio' ? 100 : 10;
        let numVal = parseFloat(value);
        if (numVal > max) numVal = max;
        if (numVal < 0) numVal = 0;
        student.grades[currentSubject][activityId] = numVal;
    }
    renderTable();
};

window.updateRecup = function(studentId, value) {
    const student = students.find(s => s.id === studentId);
    if (!student.recup) student.recup = {};
    
    if(value === "") {
        student.recup[currentSubject] = null;
    } else {
        const max = currentLevel === 'medio' ? 100 : 10;
        let numVal = parseFloat(value);
        if (numVal > max) numVal = max;
        if (numVal < 0) numVal = 0;
        student.recup[currentSubject] = numVal;
    }
    renderTable();
};

function calculateAverages(student, subjectName) {
    const subActivities = activities[subjectName] || [];
    if (subActivities.length === 0) return { bimestral: 0, final: 0 };
    
    let sum = 0, count = 0;
    const subGrades = student.grades[subjectName] || {};
    
    subActivities.forEach(act => {
        if (subGrades[act.id] !== undefined && !isNaN(subGrades[act.id])) {
            sum += subGrades[act.id];
            count++;
        }
    });

    const mediaBimestral = count > 0 ? (sum / count) : 0;
    const isMedio = currentLevel === 'medio';
    const threshold = isMedio ? 60 : 6.0;
    
    let mediaFinal = mediaBimestral;
    const recupMap = student.recup || {};
    const recupNota = recupMap[subjectName];
    
    if (mediaBimestral < threshold && recupNota !== null && recupNota !== undefined && !isNaN(recupNota)) {
        const novaMedia = (mediaBimestral + recupNota) / 2;
        mediaFinal = novaMedia > mediaBimestral ? novaMedia : mediaBimestral;
    }
    return { bimestral: mediaBimestral, final: mediaFinal };
}

// --- COMUNICAÇÃO SEGURO COM FIRESTORE ---
async function fetchFromDatabaseSecurely(level, grade, turma) {
    try {
        const docId = `${level}_${grade}_${turma}`;
        const docRef = doc(db, "classes", docId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            students = data.students || [];
            subjects = data.subjects || [];
            activities = data.activities || {};
        } else {
            students = [];
            subjects = [];
            activities = {};
        }
    } catch (error) {
        console.error("Erro ao ler banco: ", error);
        alert("Erro de conexão. Verifique sua rede.");
    }
}

window.saveDataSecurely = async function() {
    const btn = document.getElementById('btn-save');
    const originalText = btn.textContent;
    try {
        btn.textContent = "Sincronizando Nuvem...";
        btn.disabled = true;
        
        const docId = `${currentLevel}_${currentGrade}_${currentTurma}`;
        const docRef = doc(db, "classes", docId);
        
        await runTransaction(db, async (transaction) => {
            transaction.set(docRef, { 
                students: students,
                subjects: subjects,
                activities: activities,
                lastUpdated: new Date().toISOString()
            }, { merge: true });
        });
        
        alert("Dados salvos e sincronizados com a nuvem SESI!");
    } catch (error) {
        console.error("Erro na gravação: ", error);
        alert("Falha ao salvar. Tente novamente.");
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
};

// ============================================================
// RESOLUÇÃO DEFINITIVA DO PDF (INJEÇÃO DIRETA)
// ============================================================

window.generateIndividualPDF = function(studentId) {
    const student = students.find(s => s.id === studentId);
    if (!student) return;

    const isMedio = currentLevel === 'medio';
    const unit = isMedio ? '%' : '';

    // O html2pdf aceita a string HTML pura. Injetamos o estilo in-line 
    // para não depender do CSS externo (que pode estar bloqueado).
    let htmlContent = `
        <div style="padding: 30px; font-family: 'DM Sans', sans-serif; color: #0D1B2A; background: #fff; width: 100%;">
            <h2 style="text-align: center; color: #0B1E3D; font-family: 'Playfair Display', serif; margin-bottom: 5px; font-size: 24px;">BOLETIM ESCOLAR INDIVIDUAL</h2>
            <p style="text-align: center; font-size: 13px; margin-bottom: 30px; color: #556070; text-transform: uppercase; letter-spacing: 1px;">Registro Oficial de Aproveitamento</p>
            
            <div style="margin-bottom: 25px; padding: 18px; background: #FAFAF6; border-left: 5px solid #C9A227; border-radius: 6px;">
                <p style="margin: 4px 0; font-size: 16px;"><strong>Estudante:</strong> ${student.name}</p>
                <p style="margin: 4px 0; font-size: 14px; color: #1A3A6B;"><strong>Segmento:</strong> ${document.getElementById('level-select').options[document.getElementById('level-select').selectedIndex].text}</p>
                <p style="margin: 4px 0; font-size: 14px; color: #1A3A6B;"><strong>Série/Ano:</strong> ${currentGrade} &nbsp;&nbsp;&nbsp;&nbsp; <strong>Turma:</strong> ${currentTurma}</p>
            </div>

            <table style="width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 14px;">
                <thead>
                    <tr style="background-color: #0B1E3D; color: white;">
                        <th style="padding: 12px; text-align: left; border: 1px solid #E2E5EE;">Disciplina</th>
                        <th style="padding: 12px; text-align: center; border: 1px solid #E2E5EE; width: 130px;">Média Bimestral</th>
                        <th style="padding: 12px; text-align: center; border: 1px solid #E2E5EE; width: 130px;">Recuperação</th>
                        <th style="padding: 12px; text-align: center; border: 1px solid #E2E5EE; width: 130px;">Média Final</th>
                    </tr>
                </thead>
                <tbody>
    `;

    subjects.forEach(sub => {
        const medias = calculateAverages(student, sub);
        const recupMap = student.recup || {};
        const recupNota = recupMap[sub] !== undefined && recupMap[sub] !== null ? recupMap[sub].toFixed(1) + unit : '-';

        htmlContent += `
            <tr>
                <td style="padding: 12px; border: 1px solid #E2E5EE;"><strong>${sub}</strong></td>
                <td style="padding: 12px; text-align: center; border: 1px solid #E2E5EE; color: #556070;">${medias.bimestral.toFixed(1)}${unit}</td>
                <td style="padding: 12px; text-align: center; border: 1px solid #E2E5EE; color: #556070;">${recupNota}</td>
                <td style="padding: 12px; text-align: center; border: 1px solid #E2E5EE; background: #F0F4F8; font-weight: bold; color: #0B1E3D;">${medias.final.toFixed(1)}${unit}</td>
            </tr>
        `;
    });

    if(subjects.length === 0) {
        htmlContent += `<tr><td colspan="4" style="padding: 20px; text-align: center; color: #8A95A0;">Nenhuma disciplina vinculada a esta pauta.</td></tr>`;
    }

    htmlContent += `
                </tbody>
            </table>
            <div style="margin-top: 50px; text-align: center; font-size: 11px; color: #8A95A0; border-top: 1px solid #E2E5EE; padding-top: 15px;">
                <p>SESI Cabo de Santo Agostinho • Documento gerado digitalmente via Sistema de Gestão Acadêmica.</p>
            </div>
        </div>
    `;

    const opt = {
        margin:       15,
        filename:     `Boletim_Individual_${student.name.replace(/\s+/g, '_')}.pdf`,
        image:        { type: 'jpeg', quality: 0.99 },
        html2canvas:  { scale: 2, useCORS: true, scrollY: 0 },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().set(opt).from(htmlContent).save();
};

window.generateBoletimCompletoPDF = function() {
    const element = document.getElementById('grades-table').cloneNode(true);
    
    // Remove as colunas de "Ações" que não devem ir para a impressão
    element.querySelectorAll('th:last-child, td:last-child').forEach(el => el.remove());
    
    // Converte inputs para texto simples
    element.querySelectorAll('input').forEach(input => {
        const span = document.createElement('span');
        span.textContent = input.value || "-";
        span.style.fontWeight = 'bold';
        span.style.color = '#0B1E3D';
        input.parentNode.replaceChild(span, input);
    });

    // Blinda a tabela com CSS in-line para que o PDF nunca fique em branco
    element.style.width = '100%';
    element.style.borderCollapse = 'collapse';
    element.style.fontFamily = "'DM Sans', sans-serif";
    element.style.fontSize = '14px';

    element.querySelectorAll('th').forEach(th => {
        th.style.backgroundColor = '#0B1E3D';
        th.style.color = 'white';
        th.style.padding = '12px';
        th.style.textAlign = 'left';
        th.style.border = '1px solid #E2E5EE';
    });

    element.querySelectorAll('td').forEach(td => {
        td.style.padding = '12px';
        td.style.border = '1px solid #E2E5EE';
        td.style.color = '#0D1B2A';
    });

    element.querySelectorAll('.readonly-cell').forEach(cell => {
        cell.style.backgroundColor = '#F0F4F8';
        cell.style.fontWeight = 'bold';
        cell.style.color = '#0B1E3D';
    });

    const container = document.createElement('div');
    container.style.padding = '20px';
    container.style.background = '#fff';
    
    const title = document.createElement('h2');
    title.innerHTML = `Pauta Acadêmica de Classe <br><span style="font-size:14px; color:#556070; font-family: 'DM Sans', sans-serif; font-weight: normal; letter-spacing: 0.5px;">Série: ${currentGrade} | Turma: ${currentTurma} | Disciplina: ${currentSubject}</span>`;
    title.style.color = '#0B1E3D';
    title.style.fontFamily = "'Playfair Display', serif";
    title.style.marginBottom = '25px';
    title.style.borderBottom = '2px solid #C9A227';
    title.style.paddingBottom = '10px';
    
    container.appendChild(title);
    container.appendChild(element);

    const opt = {
        margin:       10,
        filename:     `Pauta_Geral_${currentGrade}_${currentTurma}_${currentSubject}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true, scrollY: 0 },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'landscape' }
    };

    html2pdf().set(opt).from(container).save();
};
