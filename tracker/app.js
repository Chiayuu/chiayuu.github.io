const $ = (id) => document.getElementById(id);
const today = new Date().toISOString().slice(0,10);
const defaultData = {profile:{sex:'female', activity:'1.375'}, weights:[], foods:[], exercises:[]};
let data = JSON.parse(localStorage.getItem('buddyHealthData') || JSON.stringify(defaultData));
let chart;

function save(){ localStorage.setItem('buddyHealthData', JSON.stringify(data)); render(); }
function setDates(){ ['weightDate','foodDate','exerciseDate'].forEach(id => $(id).value = today); }
function loadProfile(){ for(const [k,v] of Object.entries(data.profile||{})){ if($(k)) $(k).value = v; } }
function getLatestWeight(){ return [...data.weights].sort((a,b)=>b.date.localeCompare(a.date))[0]; }
function bmr(weight){ const p=data.profile, h=+p.height, age=+p.age, sex=p.sex||'female'; if(!weight||!h||!age) return null; return Math.round(10*weight + 6.25*h - 5*age + (sex==='male'?5:-161)); }
function tdee(){ const w = getLatestWeight()?.value; const base=bmr(w); return base ? Math.round(base * +(data.profile.activity||1.2)) : null; }
function caloriesFor(date, list){ return list.filter(x=>x.date===date).reduce((s,x)=>s+(+x.calories||0),0); }
function todayNet(){ const inCal=caloriesFor(today,data.foods); const outCal=caloriesFor(today,data.exercises); const budget=tdee(); return budget ? inCal - outCal - budget : null; }
function uid(){ return Math.random().toString(36).slice(2); }

function render(){
  const latest=getLatestWeight(); $('todayWeight').textContent = latest ? latest.value.toFixed(1) : '--';
  const budget=tdee(); $('todayBudget').textContent = budget ?? '--';
  const net=todayNet(); $('todayNet').textContent = net===null ? '--' : (net>0?`+${net}`:net);
  renderChart(); renderRecords();
}
function renderChart(){
  const rows=[...data.weights].sort((a,b)=>a.date.localeCompare(b.date));
  const ctx=$('weightChart');
  if(chart) chart.destroy();
  chart = new Chart(ctx,{type:'line',data:{labels:rows.map(r=>r.date),datasets:[{label:'體重 kg',data:rows.map(r=>r.value),tension:.35}]},options:{responsive:true,plugins:{legend:{display:false}},scales:{y:{beginAtZero:false}}}});
}
function renderRecords(){
  const dates=[...new Set([...data.weights,...data.foods,...data.exercises].map(x=>x.date))].sort((a,b)=>b.localeCompare(a));
  $('records').innerHTML = dates.map(date=>{
    const ws=data.weights.filter(x=>x.date===date).map(x=>`<div class="record"><span>體重 ${x.value} kg ${x.note?`｜${escapeHtml(x.note)}`:''}</span><button class="secondary" onclick="del('weights','${x.id}')">刪除</button></div>`).join('');
    const fs=data.foods.filter(x=>x.date===date).map(x=>`<div class="record"><span><span class="pill">飲食 ${x.calories||'?'} kcal</span> ${escapeHtml(x.text)}</span><button class="secondary" onclick="del('foods','${x.id}')">刪除</button></div>`).join('');
    const es=data.exercises.filter(x=>x.date===date).map(x=>`<div class="record"><span><span class="pill">運動 ${x.calories||'?'} kcal</span> ${escapeHtml(x.text)}</span><button class="secondary" onclick="del('exercises','${x.id}')">刪除</button></div>`).join('');
    return `<div class="recordGroup"><h3>${date}</h3>${ws}${fs}${es}</div>`;
  }).join('') || '<p class="note">還沒有紀錄。</p>';
}
function escapeHtml(s=''){ return s.replace(/[&<>"]/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m])); }
window.del=(list,id)=>{ data[list]=data[list].filter(x=>x.id!==id); save(); };

function wire(){
  setDates(); loadProfile(); render();
  document.querySelectorAll('.tab').forEach(btn=>btn.onclick=()=>{ document.querySelectorAll('.tab,.panel').forEach(x=>x.classList.remove('active')); btn.classList.add('active'); $(`${btn.dataset.tab}Form`).classList.add('active'); });
  $('themeBtn').onclick=()=>document.body.classList.toggle('dark');
  $('saveProfile').onclick=()=>{ data.profile={height:$('height').value,age:$('age').value,sex:$('sex').value,activity:$('activity').value,goalWeight:$('goalWeight').value,apiKey:$('apiKey').value}; save(); };
  $('weightForm').onsubmit=e=>{ e.preventDefault(); data.weights.push({id:uid(),date:$('weightDate').value,value:+$('weightValue').value,note:$('weightNote').value}); $('weightValue').value=''; $('weightNote').value=''; save(); };
  $('foodForm').onsubmit=e=>{ e.preventDefault(); data.foods.push({id:uid(),date:$('foodDate').value,text:$('foodText').value,calories:+$('foodCalories').value||null}); $('foodText').value=''; $('foodCalories').value=''; save(); };
  $('exerciseForm').onsubmit=e=>{ e.preventDefault(); data.exercises.push({id:uid(),date:$('exerciseDate').value,text:$('exerciseText').value,calories:+$('exerciseCalories').value||null}); $('exerciseText').value=''; $('exerciseCalories').value=''; save(); };
  $('analyzeBtn').onclick=analyzeToday;
  $('exportBtn').onclick=()=>{ const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='buddy-health-backup.json'; a.click(); };
  $('importBtn').onclick=()=>{ const box=$('importBox'); if(box.classList.contains('hidden')){box.classList.remove('hidden');return;} try{data=JSON.parse(box.value); save(); box.value=''; box.classList.add('hidden');}catch{alert('JSON 格式不對');}};
  $('clearBtn').onclick=()=>{ if(confirm('確定要清空所有資料嗎？')){data=JSON.parse(JSON.stringify(defaultData)); save(); loadProfile();}};
}
async function analyzeToday(){
  const key=data.profile.apiKey;
  if(!key){ $('aiResult').textContent='先在基本資料輸入妳自己的 OpenAI API key。'; return; }
  $('aiResult').textContent='分析中...';
  const payload = {date:today, profile:{...data.profile, apiKey:undefined}, latestWeight:getLatestWeight(), bmr:bmr(getLatestWeight()?.value), estimatedTdee:tdee(), foods:data.foods.filter(x=>x.date===today), exercises:data.exercises.filter(x=>x.date===today), recentWeights:[...data.weights].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,14)};
  const prompt = `你是 Gina 的健康紀錄助理 Buddy。請用繁體中文、朋友口吻，根據以下資料估算：1 飲食熱量 2 運動消耗 3 BMR/TDEE 4 今日熱量得失 5 明天建議。不要醫療診斷，熱量用估算範圍。資料：${JSON.stringify(payload)}`;
  try{
    const res = await fetch('https://api.openai.com/v1/responses', {method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${key}`}, body:JSON.stringify({model:'gpt-5.5', input:prompt})});
    const json = await res.json();
    if(!res.ok) throw new Error(json.error?.message || 'API 呼叫失敗');
    $('aiResult').textContent = json.output_text || JSON.stringify(json,null,2);
  }catch(err){ $('aiResult').textContent = `分析失敗：${err.message}\n\n提醒：GitHub Pages 前端呼叫 API 會暴露風險，正式版建議改成 Vercel/Netlify Function 後端代理。`; }
}
wire();
