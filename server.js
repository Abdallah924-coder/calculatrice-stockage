const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// SERVIR LES FICHIERS STATIQUES AVEC LES BONS HEADERS POUR PWA
app.use(express.static('public', {
    setHeaders: (res, filePath) => {
        // Pour le service worker - NE PAS LE METTRE EN CACHE
        if (filePath.endsWith('sw.js')) {
            res.setHeader('Service-Worker-Allowed', '/');
            res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
        }
        // Pour le manifest
        if (filePath.endsWith('manifest.json')) {
            res.setHeader('Content-Type', 'application/manifest+json');
            res.setHeader('Cache-Control', 'public, max-age=600');
        }
    }
}));

// Route spécifique pour le service worker
app.get('/sw.js', (req, res) => {
    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Service-Worker-Allowed', '/');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(path.join(__dirname, 'public', 'sw.js'));
});

// Route pour le manifest
app.get('/manifest.json', (req, res) => {
    res.setHeader('Content-Type', 'application/manifest+json');
    res.sendFile(path.join(__dirname, 'public', 'manifest.json'));
});

// Créer le dossier uploads s'il n'existe pas
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

// Configuration multer pour l'upload
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const userFolder = path.join(__dirname, 'uploads', req.params.password);
        if (!fs.existsSync(userFolder)) {
            fs.mkdirSync(userFolder, { recursive: true });
        }
        cb(null, userFolder);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        const nameWithoutExt = path.basename(file.originalname, ext);
        const cleanName = nameWithoutExt.substring(0, 50);
        cb(null, uniqueSuffix + '-' + cleanName + ext);
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 500 * 1024 * 1024 }
});

// Routes API (gardez vos routes existantes)
app.get('/api/files/:password', (req, res) => {
    const userFolder = path.join(__dirname, 'uploads', req.params.password);
    
    if (!fs.existsSync(userFolder)) {
        return res.json([]);
    }
    
    const files = fs.readdirSync(userFolder);
    const filesInfo = files.map(file => {
        const stats = fs.statSync(path.join(userFolder, file));
        const parts = file.split('-');
        const originalName = parts.slice(2).join('-');
        const ext = path.extname(originalName).toLowerCase();
        
        let fileType = 'other';
        if (['.mp4', '.webm', '.mov', '.avi', '.mkv'].includes(ext)) fileType = 'video';
        else if (['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'].includes(ext)) fileType = 'image';
        else if (['.pdf'].includes(ext)) fileType = 'pdf';
        else if (['.mp3', '.wav', '.ogg', '.m4a'].includes(ext)) fileType = 'audio';
        
        return {
            name: file,
            size: stats.size,
            modified: stats.mtime,
            originalName: originalName,
            fileType: fileType,
            extension: ext
        };
    });
    
    filesInfo.sort((a, b) => new Date(b.modified) - new Date(a.modified));
    res.json(filesInfo);
});

app.post('/api/upload/:password', upload.array('files'), (req, res) => {
    res.json({ 
        message: 'Fichiers uploadés avec succès', 
        files: req.files.map(f => f.filename),
        count: req.files.length
    });
});

app.delete('/api/files/:password/:filename', (req, res) => {
    const filePath = path.join(__dirname, 'uploads', req.params.password, req.params.filename);
    
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        res.json({ message: 'Fichier supprimé' });
    } else {
        res.status(404).json({ error: 'Fichier non trouvé' });
    }
});

app.get('/api/download/:password/:filename', (req, res) => {
    const filePath = path.join(__dirname, 'uploads', req.params.password, req.params.filename);
    
    if (fs.existsSync(filePath)) {
        res.download(filePath);
    } else {
        res.status(404).json({ error: 'Fichier non trouvé' });
    }
});

app.get('/api/view/:password/:filename', (req, res) => {
    const filePath = path.join(__dirname, 'uploads', req.params.password, req.params.filename);
    
    if (fs.existsSync(filePath)) {
        const ext = path.extname(filePath).toLowerCase();
        let contentType = 'application/octet-stream';
        
        if (['.mp4', '.webm'].includes(ext)) contentType = 'video/mp4';
        else if (['.jpg', '.jpeg'].includes(ext)) contentType = 'image/jpeg';
        else if (['.png'].includes(ext)) contentType = 'image/png';
        else if (['.gif'].includes(ext)) contentType = 'image/gif';
        else if (['.pdf'].includes(ext)) contentType = 'application/pdf';
        else if (['.mp3'].includes(ext)) contentType = 'audio/mpeg';
        
        res.setHeader('Content-Type', contentType);
        fs.createReadStream(filePath).pipe(res);
    } else {
        res.status(404).json({ error: 'Fichier non trouvé' });
    }
});

// Route pour servir l'index.html sur toutes les autres routes (SPA)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Serveur démarré sur http://localhost:${PORT}`);
});