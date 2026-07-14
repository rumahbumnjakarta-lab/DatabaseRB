const express = require('express');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'items.json');

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Helper to read data
function readData() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      // Create directories and empty array if file does not exist
      fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
      fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2), 'utf8');
      return [];
    }
    const data = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(data || '[]');
  } catch (err) {
    console.error('Error reading data:', err);
    return [];
  }
}

// Helper to write data
function writeData(data) {
  try {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error writing data:', err);
    return false;
  }
}

// GET /api/items - Retrieve all items or items by division
app.get('/api/items', (req, res) => {
  const { division } = req.query;
  const items = readData();
  if (division) {
    const filtered = items.filter(item => item.division === division);
    return res.json(filtered);
  }
  res.json(items);
});

// GET /api/items/:id - Retrieve a single item
app.get('/api/items/:id', (req, res) => {
  const items = readData();
  const item = items.find(i => i.id === req.params.id);
  if (!item) {
    return res.status(404).json({ error: 'Item not found' });
  }
  res.json(item);
});

// POST /api/items - Add a new item
app.post('/api/items', (req, res) => {
  const { division, cat, title, type, url, email, pass, note } = req.body;

  if (!division || !cat || !title || !type) {
    return res.status(400).json({ error: 'Missing required fields (division, cat, title, type)' });
  }

  const items = readData();
  const newItem = {
    id: uuidv4(),
    division,
    cat,
    title,
    type,
    note: note || ''
  };

  if (type === 'link') {
    newItem.url = url || '#';
  } else if (type === 'cred') {
    newItem.email = email || '';
    newItem.pass = pass || '';
  }

  items.push(newItem);
  if (writeData(items)) {
    res.status(201).json(newItem);
  } else {
    res.status(500).json({ error: 'Failed to write to database' });
  }
});

// PUT /api/items/:id - Update an existing item
app.put('/api/items/:id', (req, res) => {
  const { division, cat, title, type, url, email, pass, note } = req.body;
  const { id } = req.params;

  const items = readData();
  const idx = items.findIndex(i => i.id === id);

  if (idx === -1) {
    return res.status(404).json({ error: 'Item not found' });
  }

  // Update properties if they are provided
  if (division) items[idx].division = division;
  if (cat) items[idx].cat = cat;
  if (title) items[idx].title = title;
  if (type) items[idx].type = type;
  if (note !== undefined) items[idx].note = note;

  // Adapt properties depending on type
  const currentType = type || items[idx].type;
  if (currentType === 'link') {
    if (url !== undefined) items[idx].url = url;
    // Clean cred fields
    delete items[idx].email;
    delete items[idx].pass;
  } else if (currentType === 'cred') {
    if (email !== undefined) items[idx].email = email;
    if (pass !== undefined) items[idx].pass = pass;
    // Clean url field
    delete items[idx].url;
  }

  if (writeData(items)) {
    res.json(items[idx]);
  } else {
    res.status(500).json({ error: 'Failed to update database' });
  }
});

// DELETE /api/items/:id - Delete an item
app.delete('/api/items/:id', (req, res) => {
  const { id } = req.params;
  const items = readData();
  const filtered = items.filter(i => i.id !== id);

  if (items.length === filtered.length) {
    return res.status(404).json({ error: 'Item not found' });
  }

  if (writeData(filtered)) {
    res.json({ message: 'Item deleted successfully' });
  } else {
    res.status(500).json({ error: 'Failed to write changes to database' });
  }
});

// Serve manage.html dashboard on specific route (or default static behavior)
app.get('/manage', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'manage.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
