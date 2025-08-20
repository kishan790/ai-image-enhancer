// CONFIG: set this AFTER you deploy backend on Render
const API_BASE_URL = ''; // e.g., 'https://your-backend.onrender.com'

// State
let selectedFile = null;
let jobId = null;
let refinedBlobUrl = null;

// Elements
const hero = document.getElementById('hero');
const upload = document.getElementById('upload');
const processing = document.getElementById('processing');
const results = document.getElementById('results');
const startBtn = document.getElementById('startBtn');
const uploadZone = document.getElementById('uploadZone');
const fileInput = document.getElementById('fileInput');
const pickBtn = document.getElementById('pickBtn');
const uploadPreview = document.getElementById('uploadPreview');
const previewImage = document.getElementById('previewImage');
const fileName = document.getElementById('fileName');
const fileSize = document.getElementById('fileSize');
const enhanceBtn = document.getElementById('enhanceBtn');
const backBtn = document.getElementById('backBtn');
const processingTitle = document.getElementById('processingTitle');
const processingSubtitle = document.getElementById('processingSubtitle');
const progressFill = document.getElementById('progressFill');
const step1 = document.getElementById('step1');
const step2 = document.getElementById('step2');
const step3 = document.getElementById('step3');
const originalImage = document.getElementById('originalImage');
const refinedImage = document.getElementById('refinedImage');
const downloadBtn = document.getElementById('downloadBtn');
const enhanceAnotherBtn = document.getElementById('enhanceAnotherBtn');

// Navigation helpers
function show(section){
  hero.classList.add('hidden');
  upload.classList.add('hidden');
  processing.classList.add('hidden');
  results.classList.add('hidden');
  section.classList.remove('hidden');
}

// Hero → upload
startBtn.addEventListener('click',()=> show(upload));

// File picking
pickBtn.addEventListener('click',()=> fileInput.click());
uploadZone.addEventListener('dragover',e=>{e.preventDefault(); uploadZone.style.borderColor='#6366f1';});
uploadZone.addEventListener('dragleave',()=> uploadZone.style.borderColor='#2a2b45');
uploadZone.addEventListener('drop',e=>{
  e.preventDefault(); uploadZone.style.borderColor='#2a2b45';
  if(e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files);
});
uploadZone.addEventListener('click',()=> fileInput.click());
fileInput.addEventListener('change',e=> e.target.files?. && handleFile(e.target.files));

function handleFile(file){
  if(!file.type.startsWith('image/')){ alert('Please select an image'); return;}
  selectedFile = file;
  const reader = new FileReader();
  reader.onload = ()=>{ previewImage.src = reader.result; };
  reader.readAsDataURL(file);
  fileName.textContent = file.name;
  fileSize.textContent = ${(file.size/1024/1024).toFixed(2)}MB;
  uploadPreview.classList.remove('hidden');
}

// Back
backBtn.addEventListener('click',()=>{
  selectedFile=null; fileInput.value='';
  uploadPreview.classList.add('hidden');
  show(hero);
});

// Enhance
enhanceBtn.addEventListener('click', async ()=>{
  if(!selectedFile){ alert('Select an image first'); return; }
  show(processing);
  progressFill.style.width='10%'; step1.style.color='#fff';
  processingSubtitle.textContent='Analyzing image...';

  // If backend URL not set, simulate enhancement
  if(!API_BASE_URL){
    await simulateEnhancement();
    return;
  }

  try{
    const fd = new FormData();
    fd.append('file', selectedFile);
    const start = await fetch(${API_BASE_URL}/api/refine, { method:'POST', body: fd });
    if(!start.ok) throw new Error('Start failed');
    const data = await start.json();
    jobId = data.job_id;

    await pollStatusAndDownload();
  }catch(err){
    console.error(err);
    alert('Enhancement failed. Falling back to simulation.');
    await simulateEnhancement();
  }
});

async function pollStatusAndDownload(){
  let done=false;
  while(!done){
    const r = await fetch(${API_BASE_URL}/api/status/${jobId});
    const s = await r.json();
    progressFill.style.width = ${s.progress||10}%;
    processingSubtitle.textContent = s.message || 'Working...';
    if(s.progress>=40) step2.style.color='#fff';
    if(s.progress>=80) step3.style.color='#fff';
    if(s.status==='completed') done=true;
    else await new Promise(res=>setTimeout(res,1000));
  }
  const imgRes = await fetch(${API_BASE_URL}/api/result/${jobId});
  const blob = await imgRes.blob();
  refinedBlobUrl = URL.createObjectURL(blob);
  showResults();
}

async function simulateEnhancement(){
  // Fake timed steps
  await new Promise(r=>setTimeout(r,900)); progressFill.style.width='40%'; step2.style.color='#fff'; processingSubtitle.textContent='Enhancing quality...';
  await new Promise(r=>setTimeout(r,900)); progressFill.style.width='80%'; step3.style.color='#fff'; processingSubtitle.textContent='Finalizing...';
  await new Promise(r=>setTimeout(r,700)); progressFill.style.width='100%';

  // Simple canvas sharpen/color tweak
  const img = new Image();
  img.src = previewImage.src;
  await img.decode();
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const ctx = c.getContext('2d');
  ctx.drawImage(img,0,0);
  ctx.globalCompositeOperation='overlay';
  ctx.fillStyle='rgba(255,255,255,0.06)'; ctx.fillRect(0,0,c.width,c.height);
  ctx.globalCompositeOperation='source-over';
  refinedBlobUrl = c.toDataURL('image/png');
  showResults();
}

function showResults(){
  originalImage.src = previewImage.src;
  refinedImage.src = refinedBlobUrl;
  downloadBtn.href = refinedBlobUrl;
  show(results);
}

enhanceAnotherBtn.addEventListener('click',()=>{
  selectedFile=null; fileInput.value=''; uploadPreview.classList.add('hidden');
  refinedBlobUrl=null; jobId=null;
  step1.style.color=''; step2.style.color=''; step3.style.color='';
  progressFill.style.width='0%';
  show(upload);
});
