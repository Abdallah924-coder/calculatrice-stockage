// État de l'application
let currentPassword = null;
let currentFiles = [];

// Éléments DOM
const calculatorApp = document.getElementById('calculator-app');
const fileManager = document.getElementById('file-manager');
const displayPrevious = document.querySelector('.previous-operand');
const displayCurrent = document.querySelector('.current-operand');
const activePasswordSpan = document.getElementById('active-password');
const filesContainer = document.getElementById('files-container');

// Variables calculatrice
let currentOperand = '0';
let previousOperand = '';
let operation = null;
let shouldResetScreen = false;

// Initialisation
document.addEventListener('DOMContentLoaded', () => {
    initCalculator();
    setupEventListeners();
    registerServiceWorker();
});

function initCalculator() {
    const buttons = document.querySelectorAll('.calculator button');
    buttons.forEach(button => {
        button.removeEventListener('click', handleButtonClick);
        button.addEventListener('click', handleButtonClick);
    });
}

function handleButtonClick(e) {
    const button = e.currentTarget;
    const text = button.textContent;
    
    if (text === 'AC') clear();
    else if (text === 'DEL') deleteLast();
    else if (text === '=') evaluate();
    else if (['+', '-', '×', '÷'].includes(text)) chooseOperation(text);
    else appendNumber(text);
}

function setupEventListeners() {
    document.getElementById('close-file-manager').addEventListener('click', closeFileManager);
    document.getElementById('logout-btn').addEventListener('click', logout);
    document.getElementById('upload-btn').addEventListener('click', uploadFiles);
    document.getElementById('clear-memory-btn').addEventListener('click', clearPhoneMemory);
    document.getElementById('file-input').addEventListener('change', (e) => {
        const label = document.querySelector('.upload-label');
        const count = e.target.files.length;
        label.textContent = count > 0 ? `📄 ${count} fichier(s) sélectionné(s)` : '📤 Choisir des fichiers';
    });
    
    // Modal
    const modal = document.getElementById('viewer-modal');
    const closeBtn = document.querySelector('.modal-close');
    closeBtn.onclick = () => modal.style.display = 'none';
    window.onclick = (event) => {
        if (event.target === modal) modal.style.display = 'none';
    };
}

// Fonctions calculatrice
function clear() {
    currentOperand = '0';
    previousOperand = '';
    operation = null;
    updateDisplay();
}

function deleteLast() {
    if (currentOperand.length === 1 || (currentOperand === '0')) {
        currentOperand = '0';
    } else {
        currentOperand = currentOperand.slice(0, -1);
    }
    updateDisplay();
}

function appendNumber(number) {
    if (shouldResetScreen) {
        currentOperand = '';
        shouldResetScreen = false;
    }
    if (number === '.' && currentOperand.includes('.')) return;
    if (currentOperand === '0' && number !== '.') {
        currentOperand = number;
    } else {
        currentOperand += number;
    }
    updateDisplay();
}

function chooseOperation(op) {
    if (currentOperand === '') return;
    if (previousOperand !== '') {
        evaluate();
    }
    operation = op;
    previousOperand = currentOperand;
    currentOperand = '';
    updateDisplay();
}

function evaluate() {
    const currentValue = currentOperand;
    const secretPassword = '2468';
    
    // Vérification mot de passe secret
    if (currentValue === secretPassword && previousOperand === '' && operation === null) {
        currentPassword = secretPassword;
        openFileManager(secretPassword);
        shouldResetScreen = true;
        clear();
        return;
    }
    
    // Calcul normal
    if (operation === null || previousOperand === '' || currentOperand === '') return;
    
    let computation;
    const prev = parseFloat(previousOperand);
    const current = parseFloat(currentOperand);
    
    if (isNaN(prev) || isNaN(current)) return;
    
    switch (operation) {
        case '+': computation = prev + current; break;
        case '-': computation = prev - current; break;
        case '×': computation = prev * current; break;
        case '÷':
            if (current === 0) {
                alert('Division par zéro impossible');
                clear();
                return;
            }
            computation = prev / current;
            break;
        default: return;
    }
    
    currentOperand = computation.toString();
    operation = null;
    previousOperand = '';
    shouldResetScreen = true;
    updateDisplay();
}

function updateDisplay() {
    displayCurrent.textContent = currentOperand;
    if (operation && previousOperand) {
        displayPrevious.textContent = `${previousOperand} ${operation}`;
    } else {
        displayPrevious.textContent = '';
    }
}

// Gestionnaire de fichiers
async function openFileManager(password) {
    calculatorApp.classList.add('hidden');
    calculatorApp.classList.remove('active');
    fileManager.classList.add('active');
    activePasswordSpan.textContent = password;
    await loadFiles();
}

function closeFileManager() {
    calculatorApp.classList.remove('hidden');
    calculatorApp.classList.add('active');
    fileManager.classList.remove('active');
    currentPassword = null;
    clear();
}

function logout() {
    closeFileManager();
}

async function loadFiles() {
    if (!currentPassword) return;
    
    filesContainer.innerHTML = '<p class="loading">📂 Chargement...</p>';
    
    try {
        const response = await fetch(`/api/files/${currentPassword}`);
        const files = await response.json();
        currentFiles = files;
        displayFiles(files);
    } catch (error) {
        console.error('Erreur chargement fichiers:', error);
        filesContainer.innerHTML = '<p class="loading">❌ Erreur chargement fichiers</p>';
    }
}

function displayFiles(files) {
    if (files.length === 0) {
        filesContainer.innerHTML = '<p class="loading">📭 Aucun fichier stocké</p>';
        return;
    }
    
    filesContainer.innerHTML = '';
    files.forEach(file => {
        const fileDiv = document.createElement('div');
        fileDiv.className = 'file-item';
        
        const fileSize = formatFileSize(file.size);
        const fileDate = new Date(file.modified).toLocaleDateString('fr-FR');
        
        let typeBadge = '';
        switch(file.fileType) {
            case 'video': typeBadge = '<span class="file-type-badge badge-video">🎬 Vidéo</span>'; break;
            case 'image': typeBadge = '<span class="file-type-badge badge-image">🖼️ Image</span>'; break;
            case 'pdf': typeBadge = '<span class="file-type-badge badge-pdf">📄 PDF</span>'; break;
            case 'audio': typeBadge = '<span class="file-type-badge badge-audio">🎵 Audio</span>'; break;
            default: typeBadge = '<span class="file-type-badge">📁 Fichier</span>';
        }
        
        fileDiv.innerHTML = `
            <div class="file-info" onclick="viewFile('${file.name}', '${file.fileType}')">
                <div class="file-name">${typeBadge} ${escapeHtml(file.originalName)}</div>
                <div class="file-meta">${fileSize} • ${fileDate}</div>
            </div>
            <div class="file-actions">
                <button class="view-btn" data-filename="${file.name}" data-type="${file.fileType}">👁️ Voir</button>
                <button class="download-btn" data-filename="${file.name}">⬇️ Télécharger</button>
                <button class="delete-btn" data-filename="${file.name}">🗑️ Supprimer</button>
            </div>
        `;
        
        filesContainer.appendChild(fileDiv);
    });
    
    // Ajouter les écouteurs
    document.querySelectorAll('.view-btn').forEach(btn => {
        btn.addEventListener('click', () => viewFile(btn.dataset.filename, btn.dataset.type));
    });
    
    document.querySelectorAll('.download-btn').forEach(btn => {
        btn.addEventListener('click', () => downloadFile(btn.dataset.filename));
    });
    
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', () => deleteFile(btn.dataset.filename));
    });
}

function viewFile(filename, fileType) {
    const modal = document.getElementById('viewer-modal');
    const viewerContent = document.getElementById('viewer-content');
    const viewUrl = `/api/view/${currentPassword}/${filename}`;
    
    viewerContent.innerHTML = '';
    
    if (fileType === 'video') {
        viewerContent.innerHTML = `
            <video controls autoplay style="max-width:100%; max-height:100%;">
                <source src="${viewUrl}" type="video/mp4">
                Votre navigateur ne supporte pas la lecture vidéo.
            </video>
        `;
    } else if (fileType === 'image') {
        viewerContent.innerHTML = `<img src="${viewUrl}" alt="Image">`;
    } else if (fileType === 'pdf') {
        viewerContent.innerHTML = `<iframe src="${viewUrl}" frameborder="0"></iframe>`;
    } else if (fileType === 'audio') {
        viewerContent.innerHTML = `
            <audio controls autoplay style="width:100%;">
                <source src="${viewUrl}">
                Votre navigateur ne supporte pas la lecture audio.
            </audio>
        `;
    } else {
        // Téléchargement pour les autres types
        window.open(viewUrl, '_blank');
        modal.style.display = 'none';
        return;
    }
    
    modal.style.display = 'block';
}

async function uploadFiles() {
    const fileInput = document.getElementById('file-input');
    const files = fileInput.files;
    
    if (!files || files.length === 0) {
        alert('📁 Sélectionnez au moins un fichier');
        return;
    }
    
    const formData = new FormData();
    for (let file of files) {
        formData.append('files', file);
    }
    
    const uploadBtn = document.getElementById('upload-btn');
    const originalText = uploadBtn.textContent;
    uploadBtn.disabled = true;
    uploadBtn.textContent = '⏳ Upload en cours...';
    
    try {
        const response = await fetch(`/api/upload/${currentPassword}`, {
            method: 'POST',
            body: formData
        });
        
        if (response.ok) {
            const result = await response.json();
            alert(`✅ ${result.count} fichier(s) uploadé(s) avec succès !`);
            
            // Demander à l'utilisateur de supprimer les fichiers originaux
            const clearLocal = confirm('🗑️ Voulez-vous supprimer ces fichiers de votre téléphone pour libérer de l\'espace ?\n\n(Cliquez sur "OK" pour recevoir les instructions de suppression manuelle)');
            
            if (clearLocal) {
                showMemoryClearInstructions(files);
            }
            
            // Reset et recharger
            fileInput.value = '';
            document.querySelector('.upload-label').textContent = '📤 Choisir des fichiers';
            await loadFiles();
        } else {
            alert('❌ Erreur lors de l\'upload');
        }
    } catch (error) {
        console.error('Erreur upload:', error);
        alert('❌ Erreur réseau');
    } finally {
        uploadBtn.disabled = false;
        uploadBtn.textContent = originalText;
    }
}

function showMemoryClearInstructions(files) {
    const fileNames = Array.from(files).map(f => f.name).join('\n• ');
    
    alert(`📱 INSTRUCTIONS POUR LIBÉRER L'ESPACE MÉMOIRE:\n\n1. Vos fichiers sont maintenant en sécurité sur le serveur\n2. Pour supprimer les originaux de votre téléphone :\n\n• Sur Android : Allez dans "Fichiers" → "Téléchargements" → Supprimez ces fichiers :\n  • ${fileNames}\n\n• Sur iPhone : Allez dans "Fichiers" → Section "Téléchargements" → Supprimez ces fichiers\n\n• Sur ordinateur : Vérifiez votre dossier "Téléchargements"\n\n✨ Astuce : Utilisez le bouton "Vider mémoire téléphone" ci-dessus pour plus d'options !`);
}

async function clearPhoneMemory() {
    if (!confirm('⚠️ Cette fonction va vous aider à localiser et supprimer les fichiers originaux de votre téléphone.\n\nVoulez-vous continuer ?')) return;
    
    // Vérifier si l'API File System Access est supportée
    if ('showDirectoryPicker' in window) {
        try {
            const dirHandle = await window.showDirectoryPicker();
            alert('📂 Sélectionnez manuellement les dossiers contenant les fichiers que vous avez uploadés (Téléchargements, DCIM, etc.)\n\nPour une suppression complète, supprimez les fichiers via votre gestionnaire de fichiers système.');
        } catch (err) {
            console.log('Sélection annulée');
        }
    } else {
        // Instructions pour navigateurs non supportés
        showMemoryClearInstructions([{name: 'vos fichiers uploadés'}]);
    }
    
    // Alternative : ouvrir le gestionnaire de fichiers du système
    alert(`📱 MÉTHODE MANUELLE RECOMMANDÉE :\n\n1. Ouvrez l'application "Fichiers" ou "Galerie" de votre téléphone\n2. Allez dans "Téléchargements" ou "Images/Vidéos"\n3. Supprimez les fichiers que vous avez uploadés\n4. Videz la corbeille si nécessaire\n\n✅ Cela libérera l'espace sur votre téléphone tout en gardant les fichiers dans l'application !`);
}

async function downloadFile(filename) {
    window.open(`/api/download/${currentPassword}/${filename}`, '_blank');
}

async function deleteFile(filename) {
    if (!confirm('🗑️ Supprimer définitivement ce fichier du serveur ?')) return;
    
    try {
        const response = await fetch(`/api/files/${currentPassword}/${filename}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            await loadFiles();
            alert('✅ Fichier supprimé');
        } else {
            alert('❌ Erreur suppression');
        }
    } catch (error) {
        console.error('Erreur suppression:', error);
        alert('❌ Erreur réseau');
    }
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// PWA Service Worker
async function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        try {
            await navigator.serviceWorker.register('/sw.js');
            console.log('✅ Service Worker enregistré');
        } catch (error) {
            console.log('❌ Service Worker échec:', error);
        }
    }
}

// Exposer certaines fonctions globalement pour les appels onclick
window.viewFile = viewFile;
window.downloadFile = downloadFile;
window.deleteFile = deleteFile;