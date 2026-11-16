import { useMemo, useState } from 'react';
import { KEY_SIZES, fromBase64, fromHex, simulateBlock, toBase64, toHex } from './aes.js';

const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });
const randomBytes = (length) => crypto.getRandomValues(new Uint8Array(length));
function joinBytes(...arrays) {
  const result = new Uint8Array(arrays.reduce((n, item) => n + item.length, 0));
  let offset = 0;
  arrays.forEach((item) => { result.set(item, offset); offset += item.length; });
  return result;
}
function Panel({ title, kicker, children }) {
  return <section className="panel"><header className="panel-head"><h2 className="panel-title">{title}</h2><span className="panel-kicker">{kicker}</span></header>{children}</section>;
}

export default function App() {
  const [mode, setMode] = useState('encrypt');
  const [format, setFormat] = useState('hex');
  const [bits, setBits] = useState(128);
  const [input, setInput] = useState('Pesan rahasia dimulai di sini.');
  const [key, setKey] = useState('');
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');
  const [step, setStep] = useState(0);
  const [tab, setTab] = useState('aes');
  const [copied, setCopied] = useState(false);
  const keyBytes = useMemo(() => {
    try { const bytes = fromHex(key); return bytes.length === KEY_SIZES[bits] ? bytes : null; }
    catch { return null; }
  }, [key, bits]);
  const raw = useMemo(() => encoder.encode(input), [input]);
  const padding = 16 - raw.length % 16;
  const padded = useMemo(() => joinBytes(raw, new Uint8Array(padding).fill(padding)), [raw, padding]);
  const blocks = useMemo(() => Array.from({ length: padded.length / 16 }, (_, i) => padded.slice(i * 16, i * 16 + 16)), [padded]);
  const stages = useMemo(() => keyBytes ? simulateBlock(blocks[0], keyBytes) : [], [blocks, keyBytes]);
  const currentStep = Math.min(step, Math.max(stages.length - 1, 0));
  const stage = stages[currentStep];
  const rounds = bits === 128 ? 10 : bits === 192 ? 12 : 14;

  function generateKey() {
    setKey(toHex(randomBytes(KEY_SIZES[bits])));
    setOutput(''); setError(''); setMode('encrypt');
  }
  async function runCipher() {
    setError(''); setOutput('');
    try {
      if (!keyBytes) throw new Error(`Kunci ${bits}-bit harus berisi tepat ${bits / 4} digit Hex.`);
      const cryptoKey = await crypto.subtle.importKey('raw', keyBytes, { name: 'AES-CBC' }, false, [mode]);
      let result;
      if (mode === 'encrypt') {
        const iv = randomBytes(16);
        const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-CBC', iv }, cryptoKey, raw));
        result = joinBytes(iv, ciphertext);
      } else {
        const packed = format === 'hex' ? fromHex(input) : fromBase64(input);
        if (packed.length < 32 || (packed.length - 16) % 16) throw new Error('Data harus memuat IV 16 byte di awal, lalu ciphertext kelipatan 16 byte.');
        result = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-CBC', iv: packed.slice(0, 16) }, cryptoKey, packed.slice(16)));
      }
      setOutput(mode === 'encrypt' ? (format === 'hex' ? toHex(result) : toBase64(result)) : decoder.decode(result));
    } catch (cause) {
      setError(cause?.name === 'OperationError' ? 'Dekripsi gagal. Periksa kunci, IV, ciphertext, dan format.' : cause.message || 'Operasi tidak dapat dilakukan.');
    }
  }
  async function copyOutput() {
    if (!output) return;
    try { await navigator.clipboard.writeText(output); setCopied(true); setTimeout(() => setCopied(false), 1400); }
    catch { setError('Clipboard tidak tersedia di konteks ini.'); }
  }

  return <div className="app-shell">
    <header className="topbar"><a className="brand" href="#top" aria-label="AES Lab beranda"><span className="brand-mark">AES</span><span>Laboratorium Kriptografi</span></a><span className="top-status"><i className="status-dot" />Pemrosesan lokal · Web Crypto</span></header>
    <main className="page" id="top">
      <section className="hero"><div><p className="eyebrow">Eksperimen blok simetris</p><h1>Di balik sebuah<br />putaran AES.</h1></div><p className="hero-copy">Enkripsi teks, amati cara byte bergerak melalui matriks state, dan pahami apa yang terjadi di setiap putaran.</p></section>
      <div className="hero-rule" />
      <div className="layout"><div className="stack">
        <Panel title="Enkripsi & dekripsi" kicker="AES-CBC · PKCS#7"><div className="panel-body">
          <label className="field-label" htmlFor="message">{mode === 'encrypt' ? 'Teks yang akan dienkripsi' : 'Ciphertext + IV'}</label>
          <textarea id="message" className="textarea" value={input} onChange={(event) => setInput(event.target.value)} placeholder={mode === 'encrypt' ? 'Tulis pesan...' : 'Tempel data Hex atau Base64 hasil enkripsi...'} />
          <div className="control-row"><div className="field-grow"><label className="field-label" htmlFor="key-size">Panjang kunci</label><select id="key-size" className="select" value={bits} onChange={(event) => { setBits(Number(event.target.value)); setOutput(''); }}><option value={128}>AES-128 · 10 putaran</option><option value={192}>AES-192 · 12 putaran</option><option value={256}>AES-256 · 14 putaran</option></select></div><div><span className="field-label">Operasi</span><div className="segmented"><button className={`segment ${mode === 'encrypt' ? 'active' : ''}`} onClick={() => { setMode('encrypt'); setOutput(''); setError(''); }}>Enkripsi</button><button className={`segment ${mode === 'decrypt' ? 'active' : ''}`} onClick={() => { setMode('decrypt'); setOutput(''); setError(''); }}>Dekripsi</button></div></div></div>

          <div style={{ marginTop: 17 }}><label className="field-label" htmlFor="secret-key">Kunci · {bits / 8} byte / {bits} bit</label><div className="key-row"><input id="secret-key" className="text-input" value={key} onChange={(event) => { setKey(event.target.value.replace(/\s/g, '').toLowerCase()); setOutput(''); }} placeholder={`Hex · ${bits / 4} digit`} spellCheck="false" autoComplete="off" /><button className="button accent" onClick={generateKey}>Generate random key</button></div></div>
          <div className="button-row"><button className="button primary" onClick={runCipher}>{mode === 'encrypt' ? 'Enkripsi teks' : 'Dekripsi teks'} →</button><div className="segmented" aria-label="Format output"><button className={`segment ${format === 'hex' ? 'active' : ''}`} onClick={() => setFormat('hex')}>Hex</button><button className={`segment ${format === 'base64' ? 'active' : ''}`} onClick={() => setFormat('base64')}>Base64</button></div></div>
          {error && <p className="error-note" role="alert">{error}</p>}
          <div className="output-box"><div className="output-top"><span className="field-label" style={{ margin: 0 }}>Hasil {mode === 'encrypt' ? `· ${format.toUpperCase()} (IV + ciphertext)` : '· teks asli'}</span><button className="button" onClick={copyOutput} disabled={!output}>{copied ? 'Tersalin ✓' : 'Copy'}</button></div><div className={`output-value ${output ? '' : 'empty'}`}>{output || 'Hasil akan muncul di sini.'}</div><div className="output-meta">Kunci dan teks tidak dikirim ke server. IV acak disertakan di awal ciphertext.</div></div>
        </div></Panel>
        <Panel title="Peta blok teks" kicker="128 bit = 16 byte"><div className="panel-body"><span className="field-label">Teks UTF-8 · {raw.length} byte · {blocks.length} blok setelah padding</span><div className="block-track">{blocks.map((block, index) => <div className="block" key={index}><div className="block-head"><span>Blok {String(index + 1).padStart(2, '0')}</span><span>16 B</span></div><div className="block-bytes">{toHex(block).match(/.{1,2}/g)?.join(' ')}</div></div>)}</div><div className="padding-note"><span>↳</span><span><strong>PKCS#7:</strong> {padding} byte padding ditambahkan. Setiap byte padding bernilai sama dengan panjang padding; blok baru ditambahkan bila teks sudah pas 16 byte.</span></div></div></Panel>
      </div>
      <div className="stack">
        <Panel title="Matriks state" kicker={keyBytes ? `${bits}-bit · ${stage?.round || 0} / ${rounds} putaran` : '4 × 4 byte'}><div className="panel-body">
          <label className="field-label" htmlFor="round-step">Langkah transformasi</label><select id="round-step" className="select step-select" disabled={!stages.length} value={currentStep} onChange={(event) => setStep(Number(event.target.value))}>{stages.length ? stages.map((item, index) => <option value={index} key={index}>Putaran {String(item.round).padStart(2, '0')} · {item.label}</option>) : <option>Masukkan kunci untuk mulai</option>}</select>
          <div className="matrix-wrap"><div className="matrix" role="grid" aria-label="Matriks state AES 4 kali 4">{Array.from({ length: 16 }, (_, index) => <div className="matrix-cell" role="gridcell" key={index}>{stage ? stage.state[(index % 4) * 4 + Math.floor(index / 4)].toString(16).padStart(2, '0') : '··'}</div>)}</div></div>
          <p className="matrix-caption">Byte ditampilkan per baris · isi state tersimpan per kolom</p><div className="sim-info"><span><strong>{stage?.operation || 'Tunggu kunci'}</strong></span><span>{stage ? `${currentStep + 1} dari ${stages.length} langkah` : '16 byte per blok'}</span></div>
          {stage?.round === rounds && stage.label === 'AddRoundKey' && <p className="output-meta">Putaran akhir tidak menggunakan MixColumns, sesuai spesifikasi AES.</p>}
        </div></Panel>
        <Panel title="Panduan singkat" kicker="Dasar kriptografi"><div className="concept-tabs" role="tablist"><button role="tab" aria-selected={tab === 'aes'} className={`tab ${tab === 'aes' ? 'active' : ''}`} onClick={() => setTab('aes')}>Algoritma AES</button><button role="tab" aria-selected={tab === 'block'} className={`tab ${tab === 'block' ? 'active' : ''}`} onClick={() => setTab('block')}>Block cipher</button><button role="tab" aria-selected={tab === 'tradeoffs'} className={`tab ${tab === 'tradeoffs' ? 'active' : ''}`} onClick={() => setTab('tradeoffs')}>Kelebihan & kekurangan</button></div>
          <div className="concept-content" role="tabpanel">{tab === 'aes' ? <><p>AES mengenkripsi blok tetap 128-bit menggunakan kunci simetris. Kunci yang lebih panjang menambah jumlah putaran, bukan ukuran blok.</p><div className="stat-row"><div className="stat"><strong>128 bit</strong><span>ukuran blok</span></div><div className="stat"><strong>10 / 12 / 14</strong><span>putaran AES</span></div><div className="stat"><strong>16 / 24 / 32 B</strong><span>panjang kunci</span></div></div></> : tab === 'block' ? <><p>Block cipher mengolah data dalam potongan berukuran tetap. PKCS#7 melengkapi blok terakhir. Mode CBC menghubungkan setiap blok dengan blok sebelumnya dan memerlukan IV acak.</p><div className="stat-row"><div className="stat"><strong>CBC</strong><span>mode operasi</span></div><div className="stat"><strong>PKCS#7</strong><span>skema padding</span></div><div className="stat"><strong>16 byte</strong><span>IV per enkripsi</span></div></div></> : <><p>AES kuat dan efisien bila digunakan dengan benar. Pemakaian mode, IV, atau penyimpanan kunci yang keliru dapat melemahkan perlindungan.</p><div className="pros-cons"><div><strong>✓ Kelebihan</strong><span>Pilihan kunci fleksibel; implementasi cepat; standar yang diadopsi luas.</span></div><div><strong>! Perhatian</strong><span>CBC tidak memverifikasi integritas. Contoh ini untuk pembelajaran, bukan perlindungan data sensitif di produksi.</span></div></div></>}</div>
        </Panel>
      </div></div>
    </main>
    <footer className="footer"><span>Untuk pembelajaran kriptografi · AES menurut FIPS 197</span><span>Seluruh operasi berjalan di browser Anda</span></footer>
  </div>;
}

