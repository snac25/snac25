const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'data', 'database.json');
const OPTIONS_FILE = path.join(__dirname, 'data', 'options.json');

// 미들웨어
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// data 디렉토리 생성
if (!fs.existsSync(path.join(__dirname, 'data'))) {
  fs.mkdirSync(path.join(__dirname, 'data'));
}

// 데이터 파일 초기화
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2));
}

// 옵션 파일 초기화
if (!fs.existsSync(OPTIONS_FILE)) {
  const defaultOptions = {
    pColumn: {
      resultMapping: {
        'a': { 
          iMinusMRange: { min: 0, max: 25 }, 
          gMinusLRange: { min: 0, max: 25 },
          iGreaterThanKGreaterThanM: false
        },
        'b': { 
          iMinusMRange: { min: 26, max: 50 }, 
          gMinusLRange: { min: 26, max: 50 },
          iGreaterThanKGreaterThanM: false
        },
        'c': { 
          iMinusMRange: { min: 51, max: 75 }, 
          gMinusLRange: { min: 51, max: 75 },
          iGreaterThanKGreaterThanM: false
        },
        'd': { 
          iMinusMRange: { min: 76, max: 100 }, 
          gMinusLRange: { min: 76, max: 100 },
          iGreaterThanKGreaterThanM: false
        }
      }
    },
    qColumn: {
      gMinusLRange: { min: 0, max: 100 },
      gGreaterThanJGreaterThanL: false
    }
  };
  fs.writeFileSync(OPTIONS_FILE, JSON.stringify(defaultOptions, null, 2));
}

// 옵션 조회
app.get('/api/options', (req, res) => {
  try {
    const options = JSON.parse(fs.readFileSync(OPTIONS_FILE, 'utf8'));
    res.json(options);
  } catch (error) {
    res.status(500).json({ error: '옵션을 불러올 수 없습니다.' });
  }
});

// 옵션 저장
app.post('/api/options', (req, res) => {
  try {
    fs.writeFileSync(OPTIONS_FILE, JSON.stringify(req.body, null, 2));
    res.json({ success: true, message: '옵션이 저장되었습니다.' });
  } catch (error) {
    res.status(500).json({ error: '옵션을 저장할 수 없습니다.' });
  }
});

// 데이터 저장
app.post('/api/data', (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    const newData = {
      id: Date.now().toString(),
      ...req.body,
      createdAt: new Date().toISOString()
    };
    data.push(newData);
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    res.json({ success: true, data: newData });
  } catch (error) {
    res.status(500).json({ error: '데이터를 저장할 수 없습니다.' });
  }
});

// 전체 데이터 조회
app.get('/api/data', (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: '데이터를 불러올 수 없습니다.' });
  }
});

// 필터링된 데이터 조회
app.get('/api/data/filtered', (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    const filtered = data.filter(row => {
      const pMatch = row.P && ['a', 'b', 'c', 'd'].includes(row.P);
      const qMatch = row.Q === 'o';
      return pMatch || qMatch;
    });
    res.json(filtered);
  } catch (error) {
    res.status(500).json({ error: '데이터를 불러올 수 없습니다.' });
  }
});

// 데이터 삭제
app.delete('/api/data/:id', (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    const filtered = data.filter(item => item.id !== req.params.id);
    fs.writeFileSync(DATA_FILE, JSON.stringify(filtered, null, 2));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: '데이터를 삭제할 수 없습니다.' });
  }
});

app.listen(PORT, () => {
  console.log(`서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
});

