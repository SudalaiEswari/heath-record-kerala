// routes/records.js
const express      = require('express');
const router       = express.Router();
const multer       = require('multer');
const path         = require('path');
const fs           = require('fs');
const HealthRecord = require('../models/healthrecord');
const auth         = require('../middleware/auth');

// ─── Multer Setup ─────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '..', process.env.UPLOAD_DIR || 'uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext  = path.extname(file.originalname);
    const name = `${req.user._id}_${Date.now()}${ext}`;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: (parseInt(process.env.MAX_FILE_SIZE_MB) || 10) * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf','.jpg','.jpeg','.png'];
    if (!allowed.includes(path.extname(file.originalname).toLowerCase()))
      return cb(new Error('Only PDF, JPG, and PNG files are allowed.'));
    cb(null, true);
  },
});

// ─── GET /api/records ─────────────────────────────────────────────────────
router.get('/', auth, async (req, res) => {
  try {
    const { type, search, page = 1, limit = 20 } = req.query;
    const query = { userId: req.user._id };
    if (type)   query.type = type;
    if (search) query.title = { $regex: search, $options: 'i' };

    const records = await HealthRecord.find(query)
      .sort({ date: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    const total = await HealthRecord.countDocuments(query);
    res.json({ success: true, records, total, page: Number(page) });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to fetch records.' });
  }
});

// ─── POST /api/records ────────────────────────────────────────────────────
router.post('/', auth, upload.single('file'), async (req, res) => {
  try {
    const { title, type, date, hospital, notes } = req.body;
    if (!title || !type || !date)
      return res.status(400).json({ success: false, message: 'Title, type, and date are required.' });

    const record = await HealthRecord.create({
      userId: req.user._id,
      title, type, date,
      hospital: hospital || '',
      notes:    notes    || '',
      fileUrl:  req.file ? `/uploads/${req.file.filename}` : '',
      fileName: req.file ? req.file.originalname : '',
    });

    res.status(201).json({ success: true, message: 'Record added.', record });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Failed to add record.' });
  }
});

// ─── GET /api/records/:id ─────────────────────────────────────────────────
router.get('/:id', auth, async (req, res) => {
  try {
    const record = await HealthRecord.findOne({ _id: req.params.id, userId: req.user._id });
    if (!record) return res.status(404).json({ success: false, message: 'Record not found.' });
    res.json({ success: true, record });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to fetch record.' });
  }
});

// ─── PUT /api/records/:id ─────────────────────────────────────────────────
router.put('/:id', auth, async (req, res) => {
  try {
    const { title, type, date, hospital, notes } = req.body;
    const record = await HealthRecord.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { title, type, date, hospital, notes },
      { new: true }
    );
    if (!record) return res.status(404).json({ success: false, message: 'Record not found.' });
    res.json({ success: true, message: 'Record updated.', record });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to update record.' });
  }
});

// ─── DELETE /api/records/:id ──────────────────────────────────────────────
router.delete('/:id', auth, async (req, res) => {
  try {
    const record = await HealthRecord.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!record) return res.status(404).json({ success: false, message: 'Record not found.' });
    // Delete file if exists
    if (record.fileUrl) {
      const filePath = path.join(__dirname, '..', record.fileUrl);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    res.json({ success: true, message: 'Record deleted.' });
  } catch {
    res.status(500).json({ success: false, message: 'Failed to delete record.' });
  }
});

module.exports = router;