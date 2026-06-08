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
    activities[currentSubject].push({ id: actId, name: `Avaliação ${activities[currentSubject].length + 1}`, weight: 1 });
    renderTable();
};

// NOVA FUNÇÃO: Excluir uma coluna de avaliação específica
window.removeActivityColumn = function(actId) {
    const act = activities[currentSubject].find(a => a.id === actId);
    if(!act) return;

    if(confirm(`Tem certeza que deseja excluir a coluna "${act.name}"? Todas as notas lançadas nela serão apagadas.`)) {
        activities[currentSubject] = activities[currentSubject].filter(a => a.id !== actId);
        
        // Remove as notas desta atividade do registro dos alunos
        students.forEach(st => {
            if(st.grades && st.grades[currentSubject] && st.grades[currentSubject][actId] !== undefined) {
                delete st.grades[currentSubject][actId];
            }
        });
        
        renderTable();
    }
};

window.updateActivityName = function(id, value) {
    const act = activities[currentSubject].find(a => a.id === id);
    if(act) act.name = value;
};

window.updateActivityWeight = function(id, value) {
    const act = activities[currentSubject].find(a => a.id === id);
    if(act) {
        let val = parseFloat(value);
        if(isNaN(val) || val <= 0) val = 1; 
        act.weight = val;
        renderTable();
    }
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
        let currentWeight = act.weight !== undefined ? act.weight : 1;
        headerRow.innerHTML += `
            <th class="activity-header">
                <div style="display: flex; justify-content: space-between; align-items: center; gap: 5px;">
                    <input type="text" value="${act.name}" onchange="updateActivityName('${act.id}', this.value)" placeholder="Nome" style="width: 100%;">
                    <button onclick="removeActivityColumn('${act.id}')" title="Excluir Avaliação" style="background: transparent; border: none; color: #ff6b6b; font-size: 15px; cursor: pointer; padding: 0;">✕</button>
                </div>
                <div style="font-size: 11px; font-weight: normal; color: rgba(255,255,255,0.7); display: inline-flex; align-items: center; gap: 4px; margin-top: 4px;">
                    Peso: <input type="number" value="${currentWeight}" onchange="updateActivityWeight('${act.id}', this.value)" style="width: 45px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.3); border-radius: 3px; color: white; text-align: center; font-size: 11px; outline: none; padding: 2px;" min="0.1" step="0.1">
                </div>
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

// CÁLCULO ATUALIZADO: Regra de Recuperação por Substituição
function calculateAverages(student, subjectName) {
    const subActivities = activities[subjectName] || [];
    if (subActivities.length === 0) return { bimestral: 0, final: 0 };

    let sum = 0, weightSum = 0;
    const subGrades = student.grades[subjectName] || {};

    subActivities.forEach(act => {
        if (subGrades[act.id] !== undefined && !isNaN(subGrades[act.id])) {
            let w = act.weight !== undefined ? parseFloat(act.weight) : 1;
            if (isNaN(w) || w <= 0) w = 1;
            sum += subGrades[act.id] * w;
            weightSum += w;
        }
    });

    const mediaBimestral = weightSum > 0 ? (sum / weightSum) : 0;
    const isMedio = currentLevel === 'medio';
    const threshold = isMedio ? 60 : 6.0;

    let mediaFinal = mediaBimestral;
    const recupMap = student.recup || {};
    const recupNota = recupMap[subjectName];

    // NOVA REGRA: A nota da recuperação substitui a média final.
    if (mediaBimestral < threshold && recupNota !== null && recupNota !== undefined && !isNaN(recupNota)) {
        if (recupNota > mediaBimestral) {
            mediaFinal = recupNota;
        }
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

// ================================================================
// GERAÇÃO DE PDF — NATIVA DO NAVEGADOR
// ================================================================

const _canvasOpts = {
    scale: 2,
    useCORS: true,
    logging: false,
    scrollX: 0,
    scrollY: 0
};

const _C = {
    navy:    '#0B1E3D',
    gold:    '#C9A227',
    white:   '#FFFFFF',
    gray:    '#F0F4F8',
    text:    '#0D1B2A',
    muted:   '#556070',
    border:  '#E2E5EE',
    green:   '#1B7A4E',
    red:     '#B8233F'
};

window.generateIndividualPDF = function(studentId) {
    const student = students.find(s => s.id === studentId);
    if (!student) return;

    const isMedio = currentLevel === 'medio';
    const unit = isMedio ? '%' : '';
    const levelLabel = document.getElementById('level-select')
        .options[document.getElementById('level-select').selectedIndex].text;

    let maxAv = 0;
    subjects.forEach(sub => {
        if (activities[sub] && activities[sub].length > maxAv) maxAv = activities[sub].length;
    });

    let theadCols = `<th style="padding:10px 12px;text-align:left;border:1px solid ${_C.border};background:${_C.navy};color:#fff;font-size:12px;">Disciplina</th>`;
    for (let i = 0; i < maxAv; i++) {
        theadCols += `<th style="padding:10px 12px;text-align:center;border:1px solid ${_C.border};background:${_C.navy};color:#fff;font-size:12px;">Av. ${i+1}</th>`;
    }
    theadCols += `
        <th style="padding:10px 12px;text-align:center;border:1px solid ${_C.border};background:${_C.navy};color:#fff;font-size:12px;">Média Bim.</th>
        <th style="padding:10px 12px;text-align:center;border:1px solid ${_C.border};background:${_C.navy};color:#fff;font-size:12px;">Recuperação</th>
        <th style="padding:10px 12px;text-align:center;border:1px solid ${_C.border};background:${_C.navy};color:#fff;font-size:12px;">Média Final</th>
    `;

    let tbodyRows = '';
    subjects.forEach((sub, idx) => {
        const medias    = calculateAverages(student, sub);
        const recupMap  = student.recup || {};
        const recupNota = (recupMap[sub] !== undefined && recupMap[sub] !== null)
            ? recupMap[sub].toFixed(1) + unit : '-';
        const finalColor = medias.final >= (isMedio ? 60 : 6) ? _C.green : _C.red;
        const bg = idx % 2 === 0 ? _C.white : '#F7F9FB';
        const subActivities = activities[sub] || [];
        const subGrades = student.grades[sub] || {};

        tbodyRows += `<tr>
            <td style="padding:10px 12px;border:1px solid ${_C.border};background:${bg};font-weight:600;font-size:13px;">${sub}</td>`;

        for (let i = 0; i < maxAv; i++) {
            if (i < subActivities.length) {
                const actId = subActivities[i].id;
                const val = subGrades[actId] !== undefined ? subGrades[actId].toFixed(1) + unit : '-';
                tbodyRows += `<td style="padding:10px 12px;text-align:center;border:1px solid ${_C.border};background:${bg};font-size:12px;">${val}</td>`;
            } else {
                tbodyRows += `<td style="padding:10px 12px;text-align:center;border:1px solid ${_C.border};background:${bg};font-size:12px;color:${_C.border};">-</td>`;
            }
        }

        tbodyRows += `
            <td style="padding:10px 12px;text-align:center;border:1px solid ${_C.border};background:${_C.gray};font-size:12px;font-weight:600;color:${_C.navy};">${medias.bimestral.toFixed(1)}${unit}</td>
            <td style="padding:10px 12px;text-align:center;border:1px solid ${_C.border};background:${bg};font-size:12px;color:${_C.muted};">${recupNota}</td>
            <td style="padding:10px 12px;text-align:center;border:1px solid ${_C.border};background:${_C.gray};font-size:13px;font-weight:700;color:${finalColor};">${medias.final.toFixed(1)}${unit}</td>
        </tr>`;
    });

    if (subjects.length === 0) {
        const cols = maxAv + 4;
        tbodyRows = `<tr><td colspan="${cols}" style="padding:20px;text-align:center;color:${_C.muted};border:1px solid ${_C.border};">Nenhuma disciplina vinculada.</td></tr>`;
    }

    const htmlString = `
    <div style="font-family:Arial,sans-serif;color:${_C.text};background:#fff;padding:0;margin:0;">
        <div style="background:${_C.navy};padding:20px 28px;border-bottom:4px solid ${_C.gold};">
            <div style="font-size:20px;font-weight:700;color:#fff;margin-bottom:4px;">SESI Cabo de Santo Agostinho</div>
            <div style="font-size:11px;color:rgba(255,255,255,0.55);text-transform:uppercase;letter-spacing:1.5px;">Boletim Escolar Individual</div>
        </div>
        <div style="padding:16px 28px;background:#F7F9FB;border-bottom:1px solid ${_C.border};">
            <table style="width:100%;border-collapse:collapse;">
                <tr>
                    <td style="padding:6px 0;width:50%;vertical-align:top;">
                        <div style="font-size:10px;color:${_C.muted};text-transform:uppercase;letter-spacing:.8px;margin-bottom:3px;">Estudante</div>
                        <div style="font-size:15px;font-weight:700;color:${_C.navy};">${student.name}</div>
                    </td>
                    <td style="padding:6px 0;width:25%;vertical-align:top;">
                        <div style="font-size:10px;color:${_C.muted};text-transform:uppercase;letter-spacing:.8px;margin-bottom:3px;">Série / Turma</div>
                        <div style="font-size:13px;font-weight:600;">${currentGrade} — Turma ${currentTurma}</div>
                    </td>
                    <td style="padding:6px 0;width:25%;vertical-align:top;">
                        <div style="font-size:10px;color:${_C.muted};text-transform:uppercase;letter-spacing:.8px;margin-bottom:3px;">Segmento</div>
                        <div style="font-size:13px;font-weight:600;">${levelLabel}</div>
                    </td>
                </tr>
            </table>
        </div>
        <div style="padding:20px 28px;">
            <table style="width:100%;border-collapse:collapse;">
                <thead><tr>${theadCols}</tr></thead>
                <tbody>${tbodyRows}</tbody>
            </table>
        </div>
        <div style="padding:14px 28px;border-top:1px solid ${_C.border};text-align:center;">
            <p style="font-size:10px;color:${_C.muted};margin:0;">Documento gerado digitalmente — Sistema de Gestão Acadêmica SESI-PE</p>
        </div>
    </div>`;

    window.html2pdf().set({
        margin:      [8, 8, 8, 8],
        filename:    `Boletim_${student.name.replace(/\s+/g, '_')}.pdf`,
        image:       { type: 'jpeg', quality: 0.99 },
        html2canvas: _canvasOpts,
        jsPDF:       { unit: 'mm', format: 'a4', orientation: 'portrait' }
    }).from(htmlString).save();
};

window.generateBoletimCompletoPDF = function() {
    const isMedio = currentLevel === 'medio';
    const unit = isMedio ? '%' : '';
    const subActivities = activities[currentSubject] || [];

    const element = document.getElementById('grades-table').cloneNode(true);
    element.querySelectorAll('th:last-child, td:last-child').forEach(el => el.remove());
    
    // Remove os novos botões de fechar e lixo dos headers da tabela no clone para impressão
    element.querySelectorAll('button').forEach(btn => btn.remove());

    element.querySelectorAll('input').forEach(input => {
        const span = document.createElement('span');
        span.textContent = input.value || "-";
        span.style.fontWeight = 'bold';
        
        if (input.closest('th')) {
            span.style.color = '#ffffff';
            span.style.fontWeight = 'normal';
        } else {
            span.style.color = '#0B1E3D';
        }
        input.parentNode.replaceChild(span, input);
    });

    let avCols = '';
    subActivities.forEach(act => {
        let currentWeight = act.weight !== undefined ? act.weight : 1;
        avCols += `<th style="padding:10px 12px;text-align:center;border:1px solid ${_C.navy};background:${_C.navy};color:#fff;font-size:11px;white-space:nowrap;">${act.name}<br><span style="font-size:9px;font-weight:normal;">Peso: ${currentWeight}</span></th>`;
    });

    let tbodyRows = '';
    students.forEach((student, idx) => {
        const medias    = calculateAverages(student, currentSubject);
        const recupMap  = student.recup || {};
        const recupNota = (recupMap[currentSubject] !== undefined && recupMap[currentSubject] !== null)
            ? recupMap[currentSubject].toFixed(1) + unit : '-';
        const finalColor = medias.final >= (isMedio ? 60 : 6) ? _C.green : _C.red;
        const bg = idx % 2 === 0 ? _C.white : '#F7F9FB';
        const subGrades = student.grades[currentSubject] || {};

        let gradeCells = '';
        subActivities.forEach(act => {
            const val = subGrades[act.id] !== undefined ? subGrades[act.id].toFixed(1) + unit : '-';
            gradeCells += `<td style="padding:9px 10px;text-align:center;border:1px solid ${_C.border};background:${bg};font-size:12px;">${val}</td>`;
        });

        tbodyRows += `<tr>
            <td style="padding:9px 12px;border:1px solid ${_C.border};border-left:3px solid ${_C.gold};background:${bg};font-size:12px;font-weight:600;">${student.name}</td>
            ${gradeCells}
            <td style="padding:9px 10px;text-align:center;border:1px solid ${_C.border};background:${_C.gray};font-size:12px;font-weight:600;color:${_C.navy};">${medias.bimestral.toFixed(1)}${unit}</td>
            <td style="padding:9px 10px;text-align:center;border:1px solid ${_C.border};background:${bg};font-size:12px;color:${_C.muted};">${recupNota}</td>
            <td style="padding:9px 10px;text-align:center;border:1px solid ${_C.border};background:${_C.gray};font-size:13px;font-weight:700;color:${finalColor};">${medias.final.toFixed(1)}${unit}</td>
        </tr>`;
    });

    if (students.length === 0) {
        const cols = subActivities.length + 4;
        tbodyRows = `<tr><td colspan="${cols}" style="padding:20px;text-align:center;color:${_C.muted};border:1px solid ${_C.border};">Nenhum aluno cadastrado.</td></tr>`;
    }

    const htmlString = `
    <div style="font-family:Arial,sans-serif;color:${_C.text};background:#fff;padding:0;margin:0;">

        <div style="background:${_C.navy};padding:16px 22px;border-bottom:4px solid ${_C.gold};">
            <table style="width:100%;border-collapse:collapse;">
                <tr>
                    <td style="vertical-align:middle;">
                        <div style="font-size:17px;font-weight:700;color:#fff;">SESI Cabo de Santo Agostinho</div>
                        <div style="font-size:10px;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:1.5px;margin-top:3px;">Pauta Geral de Notas</div>
                    </td>
                    <td style="text-align:right;vertical-align:middle;">
                        <div style="font-size:14px;font-weight:600;color:#fff;">${currentSubject}</div>
                        <div style="font-size:11px;color:rgba(255,255,255,0.6);margin-top:3px;">${currentGrade} — Turma ${currentTurma}</div>
                    </td>
                </tr>
            </table>
        </div>

        <div style="padding:18px 22px;">
            <table style="width:100%;border-collapse:collapse;">
                <thead>
                    <tr>
                        <th style="padding:10px 12px;text-align:left;border:1px solid ${_C.navy};border-left:3px solid ${_C.gold};background:${_C.navy};color:#fff;font-size:11px;white-space:nowrap;">Estudante</th>
                        ${avCols}
                        <th style="padding:10px 12px;text-align:center;border:1px solid ${_C.navy};background:${_C.navy};color:#fff;font-size:11px;white-space:nowrap;">Média Bim.</th>
                        <th style="padding:10px 12px;text-align:center;border:1px solid ${_C.navy};background:${_C.navy};color:#fff;font-size:11px;white-space:nowrap;">Recuperação</th>
                        <th style="padding:10px 12px;text-align:center;border:1px solid ${_C.navy};background:${_C.navy};color:#fff;font-size:11px;white-space:nowrap;">Média Final</th>
                    </tr>
                </thead>
                <tbody>${tbodyRows}</tbody>
            </table>
        </div>

        <div style="padding:10px 22px;border-top:1px solid ${_C.border};text-align:center;">
            <p style="font-size:10px;color:${_C.muted};margin:0;">Documento gerado digitalmente — Sistema de Gestão Acadêmica SESI-PE</p>
        </div>
    </div>`;

    window.html2pdf().set({
        margin:      [6, 6, 6, 6],
        filename:    `Pauta_Geral_${currentGrade}_${currentTurma}_${currentSubject}.pdf`,
        image:       { type: 'jpeg', quality: 0.98 },
        html2canvas: _canvasOpts,
        jsPDF:       { unit: 'mm', format: 'a4', orientation: 'landscape' }
    }).from(htmlString).save();
};
