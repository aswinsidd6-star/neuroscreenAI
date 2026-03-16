import { useState, useRef, useEffect, useCallback } from "react"
import Head from "next/head"
import { supabase } from "../lib/supabase"
import { computeScore, SECTION_STYLE } from "../lib/scoring"

// ═══ QUESTION POOLS — randomly selected each session ══════════════════════
const WORD_SETS = [
  { words: ["Apple","Table","Penny"],   cues: ["a fruit","a piece of furniture","a coin"] },
  { words: ["River","Chair","Coin"],    cues: ["it flows with water","you sit on it","a type of money"] },
  { words: ["Flower","Book","Dollar"],  cues: ["a plant that blooms","you read it","a unit of money"] },
  { words: ["Orange","Lamp","Button"],  cues: ["a round orange fruit","it gives light","you press or sew it"] },
  { words: ["Candle","River","Doctor"], cues: ["you light it","it flows with water","a medical person"] },
  { words: ["Tiger","Chair","Bread"],   cues: ["a wild animal","you sit on it","a food you eat"] },
]

const SERIAL_STARTS = [
  { start: 100, step: 7, answers: [93,86,79,72,65] },
  { start: 98,  step: 7, answers: [91,84,77,70,63] },
  { start: 95,  step: 7, answers: [88,81,74,67,60] },
  { start: 90,  step: 6, answers: [84,78,72,66,60] },
  { start: 80,  step: 5, answers: [75,70,65,60,55] },
  { start: 70,  step: 4, answers: [66,62,58,54,50] },
]

const DIGIT_SETS = [
  { d2:{shown:"2 – 4",        answer:"42"},
    d3:{shown:"5 – 7 – 3",    answer:"375"},
    d4:{shown:"1 – 2 – 4 – 8",answer:"8421"},
    d5:{shown:"3 – 9 – 4 – 2 – 7",answer:"72493"} },
  { d2:{shown:"7 – 3",        answer:"37"},
    d3:{shown:"4 – 9 – 2",    answer:"294"},
    d4:{shown:"3 – 6 – 1 – 8",answer:"8163"},
    d5:{shown:"6 – 1 – 8 – 3 – 5",answer:"53816"} },
  { d2:{shown:"9 – 1",        answer:"19"},
    d3:{shown:"6 – 2 – 8",    answer:"826"},
    d4:{shown:"5 – 1 – 7 – 4",answer:"4715"},
    d5:{shown:"2 – 8 – 5 – 1 – 9",answer:"91582"} },
]

const STORIES = [
  { text:"Maria went to the market on Tuesday morning to buy vegetables. She forgot her shopping list at home, so she only remembered to buy tomatoes and onions. On the way back, she met her neighbour John, who reminded her that she also needed potatoes.",
    sr_name_q:"What was the woman's name in the story?",
    sr_day_q:"What day of the week did she go to the market?",
    sr_forgot_q:"What did she forget to bring from home?",
    sr_neighbour_q:"Who did she meet on the way back?",
    intrusion_q:"Did the story say anything about money?" },
  { text:"James walked to the library on Friday afternoon to return some books. He forgot his library card at home, so the librarian let him off with just a warning. Outside, he met his friend Sarah, who had remembered to bring her card.",
    sr_name_q:"What was the man's name in the story?",
    sr_day_q:"What day did he go to the library?",
    sr_forgot_q:"What did he forget to bring?",
    sr_neighbour_q:"Who did he meet outside?",
    intrusion_q:"Did the story mention anything about paying a fine?" },
  { text:"Priya drove to the hospital on Monday morning for her appointment. She forgot her insurance documents at home, but the receptionist let her fill them in later. In the waiting room, she spoke with her neighbour Raju, who was there for a check-up.",
    sr_name_q:"What was the woman's name in the story?",
    sr_day_q:"What day was her appointment?",
    sr_forgot_q:"What documents did she forget?",
    sr_neighbour_q:"Who did she meet in the waiting room?",
    intrusion_q:"Did the story say anything about the woman paying money?" },
]

const LETTER_SETS = [
  { letter:"F" },
  { letter:"S" },
  { letter:"A" },
  { letter:"P" },
  { letter:"B" },
]

const PICTURE_SETS = [
  { name:"Kitchen - Cookie Theft", desc:"Woman at sink washing dishes, water overflowing on floor, boy on stool reaching for cookies in jar, girl watching" },
  { name:"Garden Play", desc:"Children playing in garden with toys, grandmother watering plants, flowers blooming, bench visible" },
  { name:"Beach Scene", desc:"Family enjoying beach day, children building sandcastles, person fishing in water, beach umbrella and bucket" },
  { name:"Classroom Learning", desc:"Teacher writing on board, students seated at desks attentive, posters on walls, books and materials on desk" },
  { name:"Birthday Celebration", desc:"Children gathered around party table with cake, gifts being opened, colorful balloons and streamers, adult serving" },
]

// ═══ BUILD STEPS — called fresh each test session ══════════════════════════
function buildSteps() {
  const wordSet   = WORD_SETS[Math.floor(Math.random()*WORD_SETS.length)]
  const serial    = SERIAL_STARTS[Math.floor(Math.random()*SERIAL_STARTS.length)]
  const digits    = DIGIT_SETS[Math.floor(Math.random()*DIGIT_SETS.length)]
  const story     = STORIES[Math.floor(Math.random()*STORIES.length)]
  const letterSet = LETTER_SETS[Math.floor(Math.random()*LETTER_SETS.length)]

  const steps = [
    // INTRO
    {id:"name",  type:"text",   section:"intro", prompt:"What is your full name?",  placeholder:"Type your name here…"},
    {id:"age",   type:"number", section:"intro", prompt:"How old are you?",          placeholder:"Enter your age…"},
    {id:"gender",type:"select", section:"intro", prompt:"What is your gender?",      options:["Male","Female","Prefer not to say"]},

    // PROSPECTIVE MEMORY INSTRUCTION — planted at the start, tested at the end
    {id:"prospective_plant",type:"prospective_plant",section:"Memory",
      prompt:"Important: Please remember this instruction for later."},

    // MEMORY — word plant
    {id:"memory_plant",type:"memory_display",section:"Memory",
      prompt:"Look at these 3 words carefully.",
      words: wordSet.words},

    // ORIENTATION
    {id:"orient_year", type:"typed",section:"Orientation",prompt:"What year is it today?",                  placeholder:""},
    {id:"orient_month",type:"typed",section:"Orientation",prompt:"What month is it right now?",             placeholder:""},
    {id:"orient_day",  type:"typed",section:"Orientation",prompt:"What day of the week is today?",          placeholder:""},
    {id:"orient_date", type:"typed",section:"Orientation",prompt:"What is today's date — just the number?", placeholder:""},
    {id:"orient_place",type:"typed",section:"Orientation",prompt:"What city or town are you in right now?", placeholder:"Type the city name…"},

    // SERIAL 7s & DIGIT SPAN BACKWARD — alternating between subtraction and reverse number tests
    {id:"s7_1",type:"typed",section:"Attention",prompt:`Start with ${serial.start} and take away ${serial.step}. What do you get?`, placeholder:"Your answer…"},
    {id:"dsb_2",type:"digit_span",section:"Attention",
      prompt:"I will show you some numbers. Type them in REVERSE order — backwards.",
      digits:digits.d2.shown, answer:digits.d2.answer},
    {id:"s7_2",type:"typed",section:"Attention",prompt:`Now take away ${serial.step} from that number.`,                              placeholder:"Your answer…"},
    {id:"dsb_3",type:"digit_span",section:"Attention",
      prompt:"Good! Now try 3 numbers in reverse order.",
      digits:digits.d3.shown, answer:digits.d3.answer},
    {id:"s7_3",type:"typed",section:"Attention",prompt:`Take away ${serial.step} again. What is the result?`,                         placeholder:"Your answer…"},
    {id:"dsb_4",type:"digit_span",section:"Attention",
      prompt:"Excellent! Now 4 numbers in reverse order.",
      digits:digits.d4.shown, answer:digits.d4.answer},
    {id:"s7_4",type:"typed",section:"Attention",prompt:`Once more — take away ${serial.step}.`,                                       placeholder:"Your answer…"},
    {id:"dsb_5",type:"digit_span",section:"Attention",
      prompt:"Last one — 5 numbers in reverse order. Take your time.",
      digits:digits.d5.shown, answer:digits.d5.answer},
    {id:"s7_5",type:"typed",section:"Attention",prompt:`Last one — take away ${serial.step} one final time.`,                         placeholder:"Your answer…"},

    // NAMING — 6 objects: easy → medium → hard
    {id:"name_pencil",    type:"image_name",section:"Language",prompt:"What is this object called?",emoji:"✏️"},
    {id:"name_watch",     type:"image_name",section:"Language",prompt:"What is this object called?",emoji:"⌚"},
    {id:"name_key",       type:"image_name",section:"Language",prompt:"What is this object called?",emoji:"🔑"},
    {id:"name_scissors",  type:"image_name",section:"Language",prompt:"What is this object called?",emoji:"✂️"},
    {id:"name_thermometer",type:"image_name",section:"Language",prompt:"What is this object called?",emoji:"🌡️"},
    {id:"name_compass",   type:"image_name",section:"Language",prompt:"What is this object called?",emoji:"🧭"},

    // LANGUAGE — command, writing
    {id:"command",type:"command",section:"Language",
      prompt:"Follow these 3 steps in order:",
      instruction:"Step 1: Close your eyes\nStep 2: Count to 3 silently in your head\nStep 3: Open your eyes and tap the button below"},
    {id:"writing",type:"textarea",section:"Language",
      prompt:"Write one complete sentence about anything.",
      placeholder:"Write your sentence here…"},

    // FLUENCY
    {id:"animal_fluency",type:"fluency_animals",section:"Language",
      prompt:"Name as many animals as you can in 60 seconds."},
    {id:"letter_fluency",type:"fluency_letter",section:"Language",
      prompt:`Name as many words starting with the letter ${letterSet.letter} as you can — in 60 seconds.`,
      letter:letterSet.letter},

    // VISUOSPATIAL
    {id:"clock_draw",   type:"clock_draw",   section:"Visuospatial",
      prompt:"Draw a clock showing the time: 10 minutes past 11."},
    {id:"pentagon_draw",type:"pentagon_draw",section:"Visuospatial",
      prompt:"Copy this shape as carefully as you can."},

    // STORY
    {id:"story_read",type:"story_read",section:"Memory",
      prompt:"Read this short story carefully.",
      subtext:"Take your time. You will answer questions about it right after.",
      story:story.text},
    {id:"sr_name",     type:"typed",section:"Memory",prompt:story.sr_name_q,     placeholder:"Your answer…"},
    {id:"sr_day",      type:"typed",section:"Memory",prompt:story.sr_day_q,      placeholder:"Your answer…"},
    {id:"sr_forgot",   type:"typed",section:"Memory",prompt:story.sr_forgot_q,   placeholder:"Your answer…"},
    {id:"sr_neighbour",type:"typed",section:"Memory",prompt:story.sr_neighbour_q,placeholder:"Your answer…"},

    // INTRUSION CHECK
    {id:"intrusion_check",type:"choice",section:"Memory",
      prompt:story.intrusion_q,
      options:["No, the story did not mention money","Yes, the story mentioned money"]},

    // DISTRACTOR QUESTION
    {id:"distractor_q",type:"choice",section:"Attention",
      prompt:"Quick question before we continue — which of these is a planet in our solar system?",
      options:["Mars","Pluto (dwarf planet)","The Moon","The Sun"]},

    // PICTURE DESCRIPTION
    {id:"picture_describe",type:"picture_describe",section:"Language",
      prompt:"Look at this kitchen picture. Describe everything you see."},

    // SPEECH
    {id:"speech_record",type:"speech_record",section:"Speech",
      prompt:"Read this sentence out loud, then record your voice.",
      sentence:"The weather was warm and sunny, so the children played happily in the park all afternoon."},

    // DELAYED WORD RECALL
    {id:"memory_recall",type:"recall",section:"Memory",
      prompt:"Earlier we showed you 3 words to remember. What were they?",
      placeholder:"e.g. Apple, Table… (separate with commas)"},

    // CUED RECALL
    {id:"cued_recall",type:"cued_recall",section:"Memory",
      prompt:"Here are some hints for the 3 words. Can you remember them now?",
      subtext:"Use the hints below to try and recall the words you could not remember.",
      cues:wordSet.cues},

    // PROSPECTIVE MEMORY CHECK
    {id:"prospective_memory",type:"choice",section:"Memory",
      prompt:"At the very beginning of this test, we asked you to remember to do something at the end. Do you remember what it was?",
      subtext:"We asked you to tell us your city again at the end of the test.",
      options:["remembered","I do not remember being asked that"]},

    // ADL
    {id:"adl_medicine",type:"choice",section:"Function",prompt:"In the last 3 months — have you had difficulty managing your own medicines?",options:["no","yes"]},
    {id:"adl_money",   type:"choice",section:"Function",prompt:"Have you had difficulty handling money or paying bills?",               options:["no","yes"]},
    {id:"adl_cooking", type:"choice",section:"Function",prompt:"Have you had difficulty cooking a meal you have cooked many times before?",options:["no","yes"]},
    {id:"adl_lostway", type:"choice",section:"Function",prompt:"Have you gotten confused while going somewhere very familiar to you?",    options:["no","yes"]},
    {id:"adl_phone",   type:"choice",section:"Function",prompt:"Have you had trouble using your mobile phone or TV remote?",             options:["no","yes"]},

    // HISTORY
    {id:"family_history",  type:"choice",section:"History",prompt:"Do any close family members have Alzheimer's or serious memory problems?",options:["No, not that I know of","Yes, a distant relative","Yes, my parent or sibling"]},
    {id:"memory_complaint",type:"choice",section:"History",prompt:"Have you noticed your memory getting worse lately?",                     options:["No, my memory seems fine","A little bit, maybe","Yes, noticeably worse"]},
    {id:"depression",      type:"choice",section:"History",prompt:"In the last few months, have you felt very sad or lost interest in things?",options:["No","Sometimes","Yes, quite often"]},
    {id:"cardiovascular",  type:"choice",section:"History",prompt:"Do you have diabetes, high blood pressure, or are you overweight?",       options:["None of these","One of them","Two or more of these"]},
    {id:"education",       type:"choice",section:"History",prompt:"How many years total did you spend in school or college?",                options:["12 years or more","Between 6 and 12 years","Less than 6 years"]},
  ] as any[]

  const meta = {
    wordSet,
    serialAnswers: serial.answers,
    serialStart: serial.start,
    serialStep: serial.step,
    digitAnswers: { d2:digits.d2.answer, d3:digits.d3.answer, d4:digits.d4.answer, d5:digits.d5.answer },
    letterUsed: letterSet.letter,
  }

  return { steps, meta }
}

// ═══ DRAWING CANVAS ════════════════════════════════════════════════════════
function DrawCanvas({onDone,bgFn}:{onDone:()=>void;bgFn?:(ctx:CanvasRenderingContext2D,w:number,h:number)=>void}) {
  const ref = useRef<HTMLCanvasElement>(null)
  const painting = useRef(false)
  const last = useRef({x:0,y:0})
  const [drawn,setDrawn] = useState(false)

  useEffect(()=>{
    const c=ref.current; if(!c)return
    const ctx=c.getContext("2d")!
    ctx.fillStyle="#13192a"; ctx.fillRect(0,0,300,300)
    if(bgFn)bgFn(ctx,300,300)
  },[])

  const getPos=(e:any)=>{
    const r=ref.current!.getBoundingClientRect()
    const sx=300/r.width,sy=300/r.height
    if(e.touches)return{x:(e.touches[0].clientX-r.left)*sx,y:(e.touches[0].clientY-r.top)*sy}
    return{x:(e.clientX-r.left)*sx,y:(e.clientY-r.top)*sy}
  }
  const down=(e:any)=>{e.preventDefault();painting.current=true;last.current=getPos(e);setDrawn(true)}
  const move=(e:any)=>{
    e.preventDefault();if(!painting.current)return
    const p=getPos(e),ctx=ref.current!.getContext("2d")!
    ctx.beginPath();ctx.moveTo(last.current.x,last.current.y)
    ctx.lineTo(p.x,p.y);ctx.strokeStyle="#6ee7b7";ctx.lineWidth=3
    ctx.lineCap="round";ctx.lineJoin="round";ctx.stroke();last.current=p
  }
  const up=(e:any)=>{e.preventDefault();painting.current=false}
  const clear=()=>{
    const c=ref.current!,ctx=c.getContext("2d")!
    ctx.fillStyle="#13192a";ctx.fillRect(0,0,300,300)
    if(bgFn)bgFn(ctx,300,300);setDrawn(false)
  }

  return (
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:12}}>
      <p style={{color:"#9ca3af",fontSize:13,textAlign:"center"}}>👆 Use your finger (phone) or mouse (computer) to draw</p>
      <div style={{border:"2px solid rgba(110,231,183,0.2)",borderRadius:14,overflow:"hidden",cursor:"crosshair",touchAction:"none"}}>
        <canvas ref={ref} width={300} height={300} style={{display:"block",width:"100%",maxWidth:300}}
          onMouseDown={down} onMouseMove={move} onMouseUp={up} onMouseLeave={up}
          onTouchStart={down} onTouchMove={move} onTouchEnd={up}/>
      </div>
      <div style={{display:"flex",gap:10}}>
        <button onClick={clear} style={{background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",color:"#9ca3af",padding:"10px 20px",borderRadius:10,cursor:"pointer",fontSize:14,fontFamily:"'DM Sans',sans-serif"}}>🗑 Clear</button>
        <button onClick={onDone} disabled={!drawn} className="btn-green" style={{padding:"10px 26px",opacity:drawn?1:0.4}}>I&apos;m done →</button>
      </div>
    </div>
  )
}

// ═══ SELF RATE ══════════════════════════════════════════════════════════════
function SelfRate({options,onPick,picked}:{options:[number,string,number][];onPick:(n:number)=>void;picked:number|null}) {
  return (
    <div style={{display:"flex",flexDirection:"column",gap:9,marginTop:12}}>
      {options.map(([score,label,max])=>(
        <button key={score} onClick={()=>onPick(score)} style={{
          display:"flex",alignItems:"center",gap:12,width:"100%",textAlign:"left",
          background:picked===score?"rgba(110,231,183,0.1)":"rgba(255,255,255,0.03)",
          border:`1px solid ${picked===score?"rgba(110,231,183,0.45)":"rgba(255,255,255,0.08)"}`,
          borderRadius:12,padding:"13px 15px",cursor:"pointer",
          color:picked===score?"#6ee7b7":"#e5e7eb",fontSize:14,
          fontFamily:"'DM Sans',sans-serif",transition:"all 0.15s"}}>
          <span style={{fontFamily:"monospace",fontSize:13,minWidth:38,color:"#34d399",fontWeight:700}}>{score}/{max}</span>
          {label}
        </button>
      ))}
    </div>
  )
}

// ═══ PROGRESS BAR ══════════════════════════════════════════════════════════
function ProgressBar({current,total}:{current:number;total:number}) {
  const pct=Math.round((current/total)*100)
  return (
    <div style={{marginBottom:22}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:7}}>
        <span style={{fontFamily:"monospace",fontSize:11,color:"#6b7280"}}>Question {current} of {total}</span>
        <span style={{fontFamily:"monospace",fontSize:11,color:"#34d399"}}>{pct}% complete</span>
      </div>
      <div style={{height:5,background:"rgba(255,255,255,0.07)",borderRadius:4,overflow:"hidden"}}>
        <div style={{height:"100%",width:`${pct}%`,background:"linear-gradient(90deg,#059669,#34d399)",borderRadius:4,transition:"width 0.6s ease"}}/>
      </div>
    </div>
  )
}

// ═══ STEP COMPONENTS ═══════════════════════════════════════════════════════

function ProspectivePlantStep({onNext}:any) {
  const [confirmed,setConfirmed]=useState(false)
  useEffect(()=>{const t=setTimeout(()=>setConfirmed(true),3000);return()=>clearTimeout(t)},[])
  return (
    <div style={{textAlign:"center"}}>
      <div style={{background:"rgba(245,158,11,0.07)",border:"1px solid rgba(245,158,11,0.25)",borderRadius:18,padding:"28px 22px",marginBottom:22}}>
        <p style={{color:"#fcd34d",fontSize:13,fontFamily:"monospace",letterSpacing:"0.08em",marginBottom:14}}>📌 REMEMBER THIS FOR LATER</p>
        <p style={{fontSize:19,color:"#f9fafb",lineHeight:1.9,fontWeight:500}}>
          At the <strong style={{color:"#fcd34d"}}>very end</strong> of this test,<br/>
          we will ask if you remember this.<br/>
          The answer to give is: <strong style={{color:"#6ee7b7"}}>tell us your city again.</strong>
        </p>
      </div>
      <p style={{color:"#9ca3af",fontSize:14,marginBottom:20,lineHeight:1.7}}>Read this carefully. You will need to recall this instruction much later in the test.</p>
      <button className="btn-green" style={{fontSize:17,padding:"14px 36px",opacity:confirmed?1:0.5}} onClick={()=>onNext("seen")}>I will remember it →</button>
    </div>
  )
}

function MemoryDisplay({step,onNext}:any) {
  const [ready,setReady]=useState(false)
  const words = step.words || ["Apple","Table","Penny"]
  useEffect(()=>{const t=setTimeout(()=>setReady(true),4000);return()=>clearTimeout(t)},[])
  return (
    <div style={{textAlign:"center"}}>
      <p style={{color:"#9ca3af",fontSize:15,marginBottom:26,lineHeight:1.75}}>
        Say each word out loud — <strong style={{color:"#e5e7eb"}}>two or three times</strong>.<br/>You will need to recall them much later.
      </p>
      <div style={{display:"flex",gap:12,justifyContent:"center",flexWrap:"wrap",marginBottom:28}}>
        {words.map((w:string)=>(
          <div key={w} style={{background:"rgba(52,211,153,0.1)",border:"1px solid rgba(52,211,153,0.45)",borderRadius:16,padding:"22px 34px",fontSize:26,fontWeight:700,color:"#6ee7b7"}}>{w}</div>
        ))}
      </div>
      <div style={{background:"rgba(245,158,11,0.07)",border:"1px solid rgba(245,158,11,0.2)",borderRadius:12,padding:"12px 16px",marginBottom:22,display:"inline-block"}}>
        <p style={{color:"#fcd34d",fontSize:13}}>💡 Tip: Make a picture in your mind connecting all 3 words</p>
      </div><br/>
      <button className="btn-green" onClick={()=>onNext("seen")} style={{fontSize:17,padding:"14px 36px",opacity:ready?1:0.5}}>I remember them →</button>
    </div>
  )
}

function TypedInput({step,onNext}:any) {
  const [val,setVal]=useState("")
  const ref=useRef<HTMLInputElement>(null)
  useEffect(()=>{setVal("");setTimeout(()=>ref.current?.focus(),180)},[step.id])
  const go=()=>{if(val.trim())onNext(val.trim())}
  return (
    <div>
      <input ref={ref} className="inp" type={step.type==="number"?"number":"text"}
        placeholder={step.placeholder} value={val}
        onChange={e=>setVal(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")go()}} style={{fontSize:20}}/>
      <button className="btn-green" style={{marginTop:14,width:"100%",fontSize:17,padding:"15px"}} onClick={go}>Next →</button>
    </div>
  )
}

function SelectStep({step,onNext}:any) {
  return (
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      {step.options.map((opt:string,i:number)=>(
        <button key={i} className="choice-btn" style={{fontSize:16,padding:"16px 18px"}} onClick={()=>onNext(opt)}>
          <span style={{width:32,height:32,borderRadius:9,border:"1px solid rgba(255,255,255,0.15)",display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"monospace",fontSize:13,color:"rgba(255,255,255,0.4)",flexShrink:0,fontWeight:600}}>{String.fromCharCode(65+i)}</span>
          {opt}
        </button>
      ))}
    </div>
  )
}

function ImageName({step,onNext}:any) {
  const [val,setVal]=useState("")
  const ref=useRef<HTMLInputElement>(null)
  useEffect(()=>{setVal("");setTimeout(()=>ref.current?.focus(),180)},[step.id])
  const go=()=>{if(val.trim())onNext(val.trim())}
  return (
    <div>
      <div style={{textAlign:"center",marginBottom:24}}>
        <div style={{fontSize:96,filter:"drop-shadow(0 0 24px rgba(52,211,153,0.2))",marginBottom:10}}>{step.emoji}</div>
        <div style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:10,padding:"10px 14px",display:"inline-block"}}>
          <p style={{color:"#9ca3af",fontSize:13}}>💡 Hint: {step.hint}</p>
        </div>
      </div>
      <input ref={ref} className="inp" type="text" placeholder="Type what this object is called…" value={val}
        onChange={e=>setVal(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")go()}} style={{fontSize:20}}/>
      <button className="btn-green" style={{marginTop:14,width:"100%",fontSize:17,padding:"15px"}} onClick={go}>Next →</button>
    </div>
  )
}

function CommandStep({step,onNext}:any) {
  return (
    <div style={{textAlign:"center"}}>
      <div style={{background:"rgba(52,211,153,0.05)",border:"1px solid rgba(52,211,153,0.2)",borderRadius:18,padding:"30px 22px",marginBottom:30}}>
        {step.instruction.split('\n').map((line:string,i:number)=>(
          <p key={i} style={{fontSize:18,color:"#e5e7eb",lineHeight:2,margin:0}}>
            <span style={{color:"#34d399",fontFamily:"monospace",fontWeight:700,marginRight:8}}>{i+1}.</span>
            {line.replace(/^Step \d+: /,'')}
          </p>
        ))}
      </div>
      <button className="btn-green" style={{fontSize:17,padding:"15px 40px"}} onClick={()=>onNext("done")}>✓ Done — I followed all 3 steps</button>
    </div>
  )
}

function TextareaStep({step,onNext}:any) {
  const [val,setVal]=useState("")
  const ref=useRef<HTMLTextAreaElement>(null)
  useEffect(()=>{setVal("");setTimeout(()=>ref.current?.focus(),180)},[step.id])
  return (
    <div>
      <textarea ref={ref} className="inp" rows={4} placeholder={step.placeholder} value={val}
        onChange={e=>setVal(e.target.value)} style={{resize:"none",minHeight:120,fontSize:16}}/>
      <button className="btn-green" style={{marginTop:14,width:"100%",fontSize:17,padding:"15px"}} onClick={()=>{if(val.trim())onNext(val.trim())}}>Next →</button>
    </div>
  )
}

function DigitSpanStep({step,onNext}:any) {
  const [val,setVal]=useState("")
  const ref=useRef<HTMLInputElement>(null)
  useEffect(()=>{setVal("");setTimeout(()=>ref.current?.focus(),300)},[step.id])
  const go=()=>{if(val.trim())onNext(val.trim())}
  const digitCount = step.digits?.split("–").length || 3
  return (
    <div>
      <div style={{background:"rgba(165,180,252,0.08)",border:"1px solid rgba(165,180,252,0.3)",borderRadius:16,padding:"26px",textAlign:"center",marginBottom:22}}>
        <p style={{color:"#a5b4fc",fontSize:11,fontFamily:"monospace",letterSpacing:"0.1em",marginBottom:14}}>
          {digitCount>=5?"⚠️ CHALLENGE: 5 NUMBERS TO REVERSE:":"NUMBERS TO REVERSE:"}
        </p>
        <p style={{fontSize:36,fontWeight:700,color:"#f9fafb",letterSpacing:"0.15em",marginBottom:12}}>{step.digits}</p>
        <p style={{color:"#6b7280",fontSize:13}}>Type them backwards — last number first</p>
      </div>
      <input ref={ref} className="inp" type="text" placeholder="Type the numbers in reverse order…" value={val}
        onChange={e=>setVal(e.target.value.replace(/[^0-9\s]/g,""))} onKeyDown={e=>{if(e.key==="Enter")go()}} style={{fontSize:24,textAlign:"center",letterSpacing:"0.15em"}}/>
      <button className="btn-green" style={{marginTop:14,width:"100%",fontSize:17,padding:"15px"}} onClick={go}>Next →</button>
    </div>
  )
}

function FluencyAnimalsStep({onNext}:any) {
  const [val,setVal]=useState("")
  const [started,setStarted]=useState(false)
  const [timeLeft,setTimeLeft]=useState(60)
  const [finished,setFinished]=useState(false)
  const timerRef=useRef<any>(null)
  const ref=useRef<HTMLTextAreaElement>(null)

  const start=()=>{
    setStarted(true)
    setTimeout(()=>ref.current?.focus(),100)
    timerRef.current=setInterval(()=>{
      setTimeLeft(t=>{
        if(t<=1){clearInterval(timerRef.current);setFinished(true);return 0}
        return t-1
      })
    },1000)
  }
  useEffect(()=>()=>clearInterval(timerRef.current),[])

  const count=val.trim().length===0?0:val.trim().split(/[\n,]+/).map(s=>s.trim()).filter(s=>s.length>0).length
  const submit=()=>{clearInterval(timerRef.current);onNext(String(count))}

  return (
    <div>
      <div style={{background:"rgba(236,72,153,0.06)",border:"1px solid rgba(236,72,153,0.2)",borderRadius:14,padding:"16px",marginBottom:18}}>
        <p style={{color:"#f9a8d4",fontSize:13,lineHeight:1.7}}>
          🐾 Name any animal — dogs, cats, fish, birds, wild animals, insects, anything. Type each one on a new line or separate with commas.
        </p>
      </div>
      {!started?(
        <div style={{textAlign:"center"}}>
          <p style={{color:"#9ca3af",fontSize:15,marginBottom:20,lineHeight:1.7}}>You have <strong style={{color:"#f9fafb"}}>60 seconds</strong>. Type as many animals as you can. Ready?</p>
          <button className="btn-green" style={{fontSize:17,padding:"14px 36px"}} onClick={start}>▶ Start — 60 seconds</button>
        </div>
      ):(
        <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <span style={{fontFamily:"monospace",fontSize:13,color:"#f9a8d4",fontWeight:700}}>🐾 {count} animals so far</span>
            <span style={{fontFamily:"monospace",fontSize:20,color:timeLeft<=10?"#ef4444":"#34d399",fontWeight:700}}>{timeLeft}s</span>
          </div>
          <textarea ref={ref} className="inp" rows={6} placeholder="dog, cat, elephant, lion, eagle…"
            value={val} onChange={e=>setVal(e.target.value)} style={{resize:"none",minHeight:130,fontSize:15}}
            disabled={finished}/>
          {(finished||timeLeft===0)?(
            <div style={{marginTop:14,textAlign:"center"}}>
              <div style={{background:"rgba(52,211,153,0.07)",border:"1px solid rgba(52,211,153,0.2)",borderRadius:12,padding:"14px",marginBottom:14}}>
                <p style={{color:"#6ee7b7",fontSize:16,fontWeight:600}}>✓ Time is up! You named {count} animals.</p>
              </div>
              <button className="btn-green" style={{width:"100%",fontSize:17,padding:"15px"}} onClick={submit}>Continue →</button>
            </div>
          ):(
            <button className="btn-green" style={{marginTop:14,width:"100%",fontSize:15,padding:"12px"}} onClick={submit}>I&apos;m done — Submit</button>
          )}
        </div>
      )}
    </div>
  )
}

function FluencyLetterStep({step,onNext}:any) {
  const [val,setVal]=useState("")
  const [started,setStarted]=useState(false)
  const [timeLeft,setTimeLeft]=useState(60)
  const [finished,setFinished]=useState(false)
  const timerRef=useRef<any>(null)
  const ref=useRef<HTMLTextAreaElement>(null)
  const letter = (step.letter || "F").toLowerCase()

  const start=()=>{
    setStarted(true)
    setTimeout(()=>ref.current?.focus(),100)
    timerRef.current=setInterval(()=>{
      setTimeLeft(t=>{
        if(t<=1){clearInterval(timerRef.current);setFinished(true);return 0}
        return t-1
      })
    },1000)
  }
  useEffect(()=>()=>clearInterval(timerRef.current),[])

  const words=val.trim().length===0?[]:val.trim().split(/[\n,\s]+/).map(s=>s.trim().toLowerCase()).filter(s=>s.length>1&&s.startsWith(letter))
  const count=words.length
  const submit=()=>{clearInterval(timerRef.current);onNext(String(count))}

  return (
    <div>
      <div style={{background:"rgba(245,158,11,0.06)",border:"1px solid rgba(245,158,11,0.2)",borderRadius:14,padding:"16px",marginBottom:18}}>
        <p style={{color:"#fcd34d",fontSize:13,lineHeight:1.7}}>
          🔤 Any word starting with the letter <strong>{step.letter||"F"}</strong>. Not names of people or places. For example: {step.subtext?.split("For example: ")[1]||"fish, flower, fast…"}
        </p>
      </div>
      {!started?(
        <div style={{textAlign:"center"}}>
          <p style={{color:"#9ca3af",fontSize:15,marginBottom:20,lineHeight:1.7}}>You have <strong style={{color:"#f9fafb"}}>60 seconds</strong>. Ready?</p>
          <button className="btn-green" style={{fontSize:17,padding:"14px 36px"}} onClick={start}>▶ Start — 60 seconds</button>
        </div>
      ):(
        <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <span style={{fontFamily:"monospace",fontSize:13,color:"#fcd34d",fontWeight:700}}>🔤 {count} words so far</span>
            <span style={{fontFamily:"monospace",fontSize:20,color:timeLeft<=10?"#ef4444":"#34d399",fontWeight:700}}>{timeLeft}s</span>
          </div>
          <textarea ref={ref} className="inp" rows={6} placeholder={`Type as many ${step.letter||"F"}-words as you can!`}
            value={val} onChange={e=>setVal(e.target.value)} style={{resize:"none",minHeight:130,fontSize:15}}
            disabled={finished}/>
          {(finished||timeLeft===0)?(
            <div style={{marginTop:14,textAlign:"center"}}>
              <div style={{background:"rgba(52,211,153,0.07)",border:"1px solid rgba(52,211,153,0.2)",borderRadius:12,padding:"14px",marginBottom:14}}>
                <p style={{color:"#6ee7b7",fontSize:16,fontWeight:600}}>✓ Time is up! You named {count} words.</p>
              </div>
              <button className="btn-green" style={{width:"100%",fontSize:17,padding:"15px"}} onClick={submit}>Continue →</button>
            </div>
          ):(
            <button className="btn-green" style={{marginTop:14,width:"100%",fontSize:15,padding:"12px"}} onClick={submit}>I&apos;m done — Submit</button>
          )}
        </div>
      )}
    </div>
  )
}

// ── CLOCK DRAW ──────────────────────────────────────────────────────────────
function ClockDrawStep({onNext}:any) {
  const [phase,setPhase]=useState<"draw"|"describe"|"analysing"|"done">("draw")
  const [desc,setDesc]=useState("")
  const [result,setResult]=useState<{score:number;note:string}|null>(null)

  const bgFn=(ctx:CanvasRenderingContext2D,w:number,h:number)=>{
    ctx.strokeStyle="rgba(110,231,183,0.12)";ctx.lineWidth=1
    ctx.beginPath();ctx.arc(w/2,h/2,w/2-18,0,Math.PI*2);ctx.stroke()
    ctx.fillStyle="rgba(110,231,183,0.22)";ctx.font="bold 11px monospace";ctx.textAlign="center"
    ctx.fillText("Draw your clock here",w/2,h/2)
  }

  const analyse=async()=>{
    if(!desc.trim())return
    setPhase("analysing")
    try{
      const res=await fetch("/api/analyse-picture",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({description:desc,type:"clock"})})
      const data=await res.json()
      setResult(data)
    }catch{setResult({score:0,note:"Analysis recorded."})}
    setPhase("done")
  }

  if(phase==="draw") return(
    <div>
      <div style={{background:"rgba(99,102,241,0.06)",border:"1px solid rgba(99,102,241,0.18)",borderRadius:12,padding:"12px 16px",marginBottom:16}}>
        <p style={{color:"#a5b4fc",fontSize:14,lineHeight:1.7}}>① Draw a circle &nbsp;② Write numbers 1 to 12 inside &nbsp;③ Draw hands at <strong>11:10</strong></p>
      </div>
      <DrawCanvas bgFn={bgFn} onDone={()=>setPhase("describe")}/>
    </div>
  )

  if(phase==="describe") return(
    <div>
      <div style={{background:"rgba(99,102,241,0.07)",border:"1px solid rgba(99,102,241,0.2)",borderRadius:14,padding:16,marginBottom:16}}>
        <p style={{color:"#a5b4fc",fontSize:14,lineHeight:1.7}}>Now describe your clock drawing. Be honest — this helps the AI score it accurately.</p>
      </div>
      <textarea className="inp" rows={4}
        placeholder="e.g. I drew a circle. I wrote all 12 numbers inside. I drew two hands — one pointing to 11 and one to 2…"
        value={desc} onChange={e=>setDesc(e.target.value)}
        style={{resize:"none",minHeight:110,fontSize:15}}/>
      <button className="btn-green" style={{marginTop:14,width:"100%",fontSize:17,padding:"15px",opacity:desc.trim().length>5?1:0.4}}
        onClick={analyse} disabled={desc.trim().length<5}>
        Submit for AI Analysis →
      </button>
    </div>
  )

  if(phase==="analysing") return(
    <div style={{textAlign:"center",padding:"40px 0"}}>
      <div className="dots"><span/><span/><span/></div>
      <p style={{color:"#6b7280",fontSize:14,marginTop:14}}>AI is analysing your clock drawing…</p>
    </div>
  )

  return(
    <div>
      <div style={{background:"rgba(52,211,153,0.06)",border:"1px solid rgba(52,211,153,0.25)",borderRadius:14,padding:"18px",marginBottom:16}}>
        <div style={{display:"flex",alignItems:"center",gap:14}}>
          <span style={{fontSize:32,fontWeight:700,color:"#34d399",fontFamily:"monospace",flexShrink:0}}>{result?.score}/5</span>
          <div>
            <p style={{color:"#6ee7b7",fontSize:14,fontWeight:600,marginBottom:3}}>Clock drawing scored</p>
            <p style={{color:"#9ca3af",fontSize:13,lineHeight:1.55}}>{result?.note}</p>
          </div>
        </div>
      </div>
      <button className="btn-green" style={{width:"100%",fontSize:17,padding:"15px"}} onClick={()=>onNext(String(result?.score??0))}>Continue →</button>
    </div>
  )
}

// ── PENTAGON DRAW ──────────────────────────────────────────────────────────
function PentagonDrawStep({onNext}:any) {
  const [phase,setPhase]=useState<"draw"|"describe"|"analysing"|"done">("draw")
  const [desc,setDesc]=useState("")
  const [result,setResult]=useState<{score:number;note:string}|null>(null)

  const bgFn=(ctx:CanvasRenderingContext2D,w:number,h:number)=>{
    const drawP=(cx:number,cy:number,r:number)=>{
      ctx.beginPath()
      for(let i=0;i<5;i++){const a=(i*2*Math.PI/5)-Math.PI/2;i===0?ctx.moveTo(cx+r*Math.cos(a),cy+r*Math.sin(a)):ctx.lineTo(cx+r*Math.cos(a),cy+r*Math.sin(a))}
      ctx.closePath();ctx.strokeStyle="rgba(165,180,252,0.7)";ctx.lineWidth=2.5;ctx.stroke()
    }
    drawP(w-75,52,38);drawP(w-75+34,52+18,38)
    ctx.fillStyle="rgba(165,180,252,0.35)";ctx.font="bold 10px monospace";ctx.textAlign="center"
    ctx.fillText("↗ COPY THESE SHAPES BELOW",w/2,h-12)
  }

  const analyse=async()=>{
    if(!desc.trim())return
    setPhase("analysing")
    try{
      const res=await fetch("/api/analyse-picture",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({description:desc,type:"pentagon"})})
      const data=await res.json()
      setResult(data)
    }catch{setResult({score:0,note:"Analysis recorded."})}
    setPhase("done")
  }

  if(phase==="draw") return(
    <div>
      <p style={{color:"#9ca3af",fontSize:14,marginBottom:14,lineHeight:1.75}}>Look at the two five-sided shapes in the <strong style={{color:"#a5b4fc"}}>top-right corner</strong>. They overlap. Copy them below.</p>
      <DrawCanvas bgFn={bgFn} onDone={()=>setPhase("describe")}/>
    </div>
  )

  if(phase==="describe") return(
    <div>
      <div style={{background:"rgba(99,102,241,0.07)",border:"1px solid rgba(99,102,241,0.2)",borderRadius:14,padding:16,marginBottom:16}}>
        <p style={{color:"#a5b4fc",fontSize:14,lineHeight:1.7}}>Describe your drawing. Did the shapes overlap? Did they have 5 sides each?</p>
      </div>
      <textarea className="inp" rows={3}
        placeholder="e.g. I drew two five-sided shapes and they overlap in the middle…"
        value={desc} onChange={e=>setDesc(e.target.value)}
        style={{resize:"none",minHeight:90,fontSize:15}}/>
      <button className="btn-green" style={{marginTop:14,width:"100%",fontSize:17,padding:"15px",opacity:desc.trim().length>5?1:0.4}}
        onClick={analyse} disabled={desc.trim().length<5}>
        Submit for AI Analysis →
      </button>
    </div>
  )

  if(phase==="analysing") return(
    <div style={{textAlign:"center",padding:"40px 0"}}>
      <div className="dots"><span/><span/><span/></div>
      <p style={{color:"#6b7280",fontSize:14,marginTop:14}}>AI is analysing your pentagon drawing…</p>
    </div>
  )

  return(
    <div>
      <div style={{background:"rgba(52,211,153,0.06)",border:"1px solid rgba(52,211,153,0.25)",borderRadius:14,padding:"18px",marginBottom:16}}>
        <div style={{display:"flex",alignItems:"center",gap:14}}>
          <span style={{fontSize:32,fontWeight:700,color:"#34d399",fontFamily:"monospace",flexShrink:0}}>{result?.score}/2</span>
          <div>
            <p style={{color:"#6ee7b7",fontSize:14,fontWeight:600,marginBottom:3}}>Pentagon drawing scored</p>
            <p style={{color:"#9ca3af",fontSize:13,lineHeight:1.55}}>{result?.note}</p>
          </div>
        </div>
      </div>
      <button className="btn-green" style={{width:"100%",fontSize:17,padding:"15px"}} onClick={()=>onNext(String(result?.score??0))}>Continue →</button>
    </div>
  )
}

function StoryReadStep({step,onNext}:any) {
  const [canContinue,setCanContinue]=useState(false)
  useEffect(()=>{const t=setTimeout(()=>setCanContinue(true),6000);return()=>clearTimeout(t)},[])
  return(
    <div>
      <p style={{color:"#9ca3af",fontSize:14,marginBottom:18,lineHeight:1.75}}>{step.subtext}</p>
      <div style={{background:"rgba(165,180,252,0.05)",border:"1px solid rgba(165,180,252,0.2)",borderRadius:16,padding:"26px 22px",marginBottom:18,lineHeight:2.1,fontSize:17,color:"#f0f0f0"}}>
        &ldquo;{step.story}&rdquo;
      </div>
      <p style={{color:"#6b7280",fontSize:13,marginBottom:20}}>📌 The story will disappear when you continue — read it carefully now.</p>
      <button className="btn-green" style={{width:"100%",fontSize:17,padding:"15px",opacity:canContinue?1:0.5}} onClick={()=>onNext("read")}>I have read it →</button>
    </div>
  )
}

function PictureDescribeStep({onNext}:any) {
  const [val,setVal]=useState("")
  const [loading,setLoading]=useState(false)
  const [result,setResult]=useState<{score:number;note:string}|null>(null)

  const analyse=async()=>{
    if(val.trim().length<10)return
    setLoading(true)
    try{
      const res=await fetch("/api/analyse-picture",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({description:val,type:"picture"})})
      const data=await res.json()
      setResult(data)
    }catch{setResult({score:0,note:"Description recorded."})}
    setLoading(false)
  }

  return(
    <div>
      <p style={{color:"#9ca3af",fontSize:14,marginBottom:14,lineHeight:1.75}}>
        Look carefully at this picture. Describe <strong style={{color:"#e5e7eb"}}>every person, every action, every object</strong> you can see.
      </p>
      {/* Boston Cookie Theft Scene */}
      <div style={{background:"#f5ede0",borderRadius:16,padding:"12px",marginBottom:16,border:"2px solid rgba(200,160,106,0.4)"}}>
        <p style={{color:"#7a5230",fontSize:10,fontFamily:"monospace",letterSpacing:"0.08em",textAlign:"center",marginBottom:8}}>🖼️ LOOK AT THIS PICTURE CAREFULLY — describe everything you see</p>
        <svg viewBox="0 0 500 300" style={{width:"100%",borderRadius:10,display:"block"}} xmlns="http://www.w3.org/2000/svg">
          <rect width="500" height="300" fill="#f0e6d3"/>
          <rect x="0" y="220" width="500" height="80" fill="#d4b896"/>
          <line x1="0" y1="220" x2="500" y2="220" stroke="#b8956a" strokeWidth="2"/>
          <rect x="25" y="35" width="95" height="110" fill="#b8d9f0" stroke="#8b7355" strokeWidth="2.5" rx="3"/>
          <line x1="72" y1="35" x2="72" y2="145" stroke="#8b7355" strokeWidth="2"/>
          <line x1="25" y1="90" x2="120" y2="90" stroke="#8b7355" strokeWidth="2"/>
          <rect x="295" y="15" width="190" height="125" fill="#c8a06a" stroke="#8b7355" strokeWidth="2" rx="3"/>
          <line x1="390" y1="15" x2="390" y2="140" stroke="#8b7355" strokeWidth="2"/>
          <rect x="295" y="15" width="95" height="125" fill="#e0b87a" stroke="#8b7355" strokeWidth="1.5" rx="2"/>
          <rect x="308" y="50" width="52" height="70" fill="#cd853f" stroke="#8b5a2b" strokeWidth="2" rx="7"/>
          <rect x="311" y="44" width="46" height="14" fill="#a0522d" rx="4"/>
          <text x="334" y="92" fill="#fff" fontSize="9" fontFamily="monospace" textAnchor="middle">COOKIES</text>
          <circle cx="365" cy="105" r="9" fill="#d2691e" stroke="#8b4513" strokeWidth="1.5"/>
          <circle cx="350" cy="118" r="8" fill="#d2691e" stroke="#8b4513" strokeWidth="1.5"/>
          <circle cx="372" cy="122" r="7" fill="#d2691e" stroke="#8b4513" strokeWidth="1.5"/>
          <rect x="325" y="158" width="58" height="7" fill="#8b7355" rx="3" transform="rotate(-8,325,158)"/>
          <rect x="330" y="164" width="7" height="56" fill="#8b7355"/>
          <rect x="366" y="164" width="7" height="56" fill="#8b7355"/>
          <circle cx="352" cy="98" r="17" fill="#fdbcb4"/>
          <path d="M335,90 Q352,76 369,90" fill="#4a3728"/>
          <rect x="337" y="113" width="30" height="46" fill="#4a90d9" rx="5"/>
          <line x1="367" y1="125" x2="392" y2="88" stroke="#fdbcb4" strokeWidth="9" strokeLinecap="round"/>
          <circle cx="395" cy="85" r="7" fill="#fdbcb4"/>
          <line x1="337" y1="125" x2="320" y2="142" stroke="#fdbcb4" strokeWidth="9" strokeLinecap="round"/>
          <circle cx="272" cy="132" r="15" fill="#fdbcb4"/>
          <path d="M257,126 Q272,113 287,126" fill="#6b3a2a"/>
          <rect x="258" y="145" width="28" height="44" fill="#e879a0" rx="5"/>
          <line x1="258" y1="158" x2="240" y2="172" stroke="#fdbcb4" strokeWidth="7" strokeLinecap="round"/>
          <line x1="286" y1="158" x2="304" y2="152" stroke="#fdbcb4" strokeWidth="7" strokeLinecap="round"/>
          <rect x="128" y="175" width="118" height="50" fill="#a8bcd4" stroke="#7a9bb5" strokeWidth="2" rx="3"/>
          <rect x="138" y="183" width="98" height="35" fill="#7fb3d3" rx="3"/>
          <rect x="180" y="163" width="7" height="20" fill="#999"/>
          <rect x="172" y="163" width="23" height="5" fill="#999" rx="3"/>
          <path d="M138,218 Q148,232 143,250 Q158,240 153,255 Q168,245 163,260 Q178,250 173,264 Q188,254 183,268 Q198,260 205,272 Q218,262 222,275 Q232,265 236,278 L138,278Z" fill="#7fb3d3" opacity="0.75"/>
          <circle cx="162" cy="128" r="18" fill="#fdbcb4"/>
          <path d="M144,121 Q162,106 180,121 Q180,108 162,103 Q144,108 144,121Z" fill="#8b6347"/>
          <rect x="146" y="144" width="33" height="52" fill="#7c5cbf" rx="5"/>
          <line x1="146" y1="160" x2="126" y2="180" stroke="#fdbcb4" strokeWidth="8" strokeLinecap="round"/>
          <ellipse cx="114" cy="186" rx="16" ry="20" fill="#e8e8e8" stroke="#ccc" strokeWidth="2"/>
          <line x1="179" y1="160" x2="196" y2="176" stroke="#fdbcb4" strokeWidth="8" strokeLinecap="round"/>
          <rect x="128" y="225" width="362" height="10" fill="#c8a06a" stroke="#8b7355" strokeWidth="1"/>
          <text x="352" y="295" fill="#7a5230" fontSize="8" fontFamily="monospace" textAnchor="middle">boy stealing cookies</text>
          <text x="162" y="295" fill="#1a6491" fontSize="8" fontFamily="monospace" textAnchor="middle">water overflowing</text>
          <text x="272" y="295" fill="#9a2070" fontSize="8" fontFamily="monospace" textAnchor="middle">girl watching</text>
        </svg>
      </div>
      <textarea className="inp" rows={6}
        placeholder="Describe everything you see: the people, what they are doing, what objects are there, anything unusual happening…"
        value={val} onChange={e=>setVal(e.target.value)}
        style={{resize:"none",minHeight:130,fontSize:15}}/>
      <div style={{background:"rgba(99,102,241,0.06)",border:"1px solid rgba(99,102,241,0.2)",borderRadius:10,padding:"10px 14px",marginTop:10,marginBottom:14}}>
        <p style={{color:"#a5b4fc",fontSize:12,lineHeight:1.6}}>💡 Describe the woman, the child, the water, the cupboard, the stool. More detail = better score.</p>
      </div>
      {!result?(
        <button className="btn-green" style={{width:"100%",fontSize:17,padding:"15px",opacity:val.trim().length>10?1:0.4}}
          onClick={analyse} disabled={loading||val.trim().length<10}>
          {loading?"AI is deeply analysing your description…":"Submit Description →"}
        </button>
      ):(
        <div style={{marginTop:14,background:"rgba(52,211,153,0.06)",border:"1px solid rgba(52,211,153,0.2)",borderRadius:12,padding:"16px"}}>
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
            <span style={{fontSize:28,fontWeight:700,color:"#34d399",fontFamily:"monospace",flexShrink:0}}>{result.score}/5</span>
            <p style={{fontSize:13,color:"#9ca3af",flex:1,lineHeight:1.6}}>{result.note}</p>
          </div>
          <button className="btn-green" style={{width:"100%",padding:"12px 20px",fontSize:16}} onClick={()=>onNext(String(result.score))}>Continue →</button>
        </div>
      )}
    </div>
  )
}

// ═══ SPEECH ══════════════════════════════════════════════════════════════════
function SpeechRecordStep({step,onNext}:any) {
  const [phase,setPhase]=useState<"ready"|"recording"|"done"|"analysing"|"complete">("ready")
  const [transcript,setTranscript]=useState("")
  const [score,setScore]=useState<number|null>(null)
  const [feedback,setFeedback]=useState("")
  const [seconds,setSeconds]=useState(0)
  const [manualScore,setManualScore]=useState<number|null>(null)
  const [attempts,setAttempts]=useState(0)
  const recogRef=useRef<any>(null)
  const timerRef=useRef<any>(null)
  const collectedRef=useRef<string[]>([])
  const stoppingRef=useRef(false)

  const SR=typeof window!=="undefined"?((window as any).SpeechRecognition||(window as any).webkitSpeechRecognition):null

  const cleanup=useCallback(()=>{
    if(recogRef.current){
      const r=recogRef.current
      r.onresult=null;r.onerror=null;r.onend=null
      try{r.abort()}catch(_){}
      recogRef.current=null
    }
    clearInterval(timerRef.current)
  },[])

  useEffect(()=>()=>{cleanup()},[cleanup])

  const startRec=()=>{
    if(!SR)return
    stoppingRef.current=false
    collectedRef.current=[]
    setTranscript("");setSeconds(0);setAttempts(a=>a+1)
    const recog=new SR()
    recog.continuous=false
    recog.interimResults=false
    recog.lang="en-US"
    recog.maxAlternatives=1
    recog.onresult=(e:any)=>{
      for(let i=e.resultIndex;i<e.results.length;i++){
        if(e.results[i].isFinal){collectedRef.current.push(e.results[i][0].transcript.trim())}
      }
      setTranscript(collectedRef.current.join(" "))
    }
    recog.onerror=(e:any)=>{clearInterval(timerRef.current);if(e.error!=="aborted")setPhase("done")}
    recog.onend=()=>{clearInterval(timerRef.current);if(!stoppingRef.current){setTranscript(collectedRef.current.join(" "));setPhase("done")}}
    recogRef.current=recog
    recog.start()
    setPhase("recording")
    timerRef.current=setInterval(()=>{
      setSeconds(s=>{
        if(s>=22){stoppingRef.current=true;cleanup();setTranscript(collectedRef.current.join(" "));setPhase("done");return s}
        return s+1
      })
    },1000)
  }

  const stopRec=()=>{stoppingRef.current=true;cleanup();setTranscript(collectedRef.current.join(" "));setPhase("done")}

  const analyse=async(text:string)=>{
    setPhase("analysing")
    try{
      const res=await fetch("/api/analyse-speech",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({transcript:text,sentence:step.sentence})})
      const data=await res.json()
      setScore(data.score);setFeedback(data.note)
    }catch{setScore(0);setFeedback("Speech recorded.")}
    setPhase("complete")
  }

  const reset=()=>{setPhase("ready");setTranscript("");collectedRef.current=[]}

  return(
    <div>
      <div style={{background:"rgba(165,180,252,0.06)",border:"1px solid rgba(165,180,252,0.25)",borderRadius:16,padding:"22px",marginBottom:22,textAlign:"center"}}>
        <p style={{color:"#a5b4fc",fontSize:11,fontFamily:"monospace",letterSpacing:"0.1em",marginBottom:14}}>📢 READ THIS SENTENCE OUT LOUD:</p>
        <p style={{fontSize:19,color:"#f9fafb",lineHeight:1.9,fontStyle:"italic"}}>&ldquo;{step.sentence}&rdquo;</p>
        <p style={{color:"#6b7280",fontSize:12,marginTop:12}}>Read it slowly and clearly. Practise once before recording.</p>
      </div>

      {phase==="ready"&&(
        <div style={{textAlign:"center"}}>
          {SR?(
            <><p style={{color:"#9ca3af",fontSize:14,marginBottom:22,lineHeight:1.7}}>Practise reading the sentence above. Then press Start and read it clearly into your microphone.</p>
            <button className="btn-green" style={{fontSize:17,padding:"15px 38px"}} onClick={startRec}>🎙️ Start Recording</button></>
          ):(
            <div>
              <div style={{background:"rgba(245,158,11,0.07)",border:"1px solid rgba(245,158,11,0.2)",borderRadius:12,padding:"12px 16px",marginBottom:18}}>
                <p style={{color:"#fcd34d",fontSize:13}}>⚠️ Microphone not available. Please rate your reading:</p>
              </div>
              <SelfRate picked={manualScore} onPick={n=>setManualScore(n)} options={[[5,"Read it smoothly, no mistakes",5],[4,"One or two small pauses",5],[3,"Some difficulty with words",5],[2,"Struggled with several words",5],[1,"Very difficult",5]]}/>
              {manualScore!==null&&<button className="btn-green" style={{marginTop:14,width:"100%",fontSize:17,padding:"15px"}} onClick={()=>onNext(String(manualScore))}>Next →</button>}
            </div>
          )}
        </div>
      )}

      {phase==="recording"&&(
        <div style={{textAlign:"center"}}>
          <p style={{color:"#ef4444",fontFamily:"monospace",fontSize:16,marginBottom:6,fontWeight:700}}>🔴 RECORDING — {seconds}s / 22s</p>
          <p style={{color:"#6b7280",fontSize:13,marginBottom:20}}>Speak clearly and naturally</p>
          {transcript&&(
            <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:11,padding:"13px",marginBottom:18,textAlign:"left"}}>
              <p style={{color:"#6b7280",fontSize:10,fontFamily:"monospace",marginBottom:6}}>WE HEARD:</p>
              <p style={{color:"#e5e7eb",fontSize:14,fontStyle:"italic"}}>&ldquo;{transcript}&rdquo;</p>
            </div>
          )}
          <button className="btn-green" style={{fontSize:15,padding:"12px 30px"}} onClick={stopRec}>⏹ Stop</button>
        </div>
      )}

      {phase==="done"&&(
        <div>
          <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.09)",borderRadius:12,padding:"16px",marginBottom:18}}>
            <p style={{color:"#6b7280",fontSize:10,fontFamily:"monospace",letterSpacing:"0.08em",marginBottom:8}}>WE HEARD YOU SAY:</p>
            <p style={{color:"#e5e7eb",fontSize:15,lineHeight:1.65,fontStyle:"italic"}}>&ldquo;{transcript||"(Nothing captured)"}&rdquo;</p>
          </div>
          {transcript?(
            <div style={{display:"flex",gap:10}}>
              <button onClick={reset} style={{flex:1,background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",color:"#9ca3af",padding:"12px",borderRadius:11,cursor:"pointer",fontSize:14,fontFamily:"'DM Sans',sans-serif"}}>🔄 Try Again</button>
              <button className="btn-green" style={{flex:2,fontSize:16,padding:"12px"}} onClick={()=>analyse(transcript)}>✓ Use this →</button>
            </div>
          ):(
            <div>
              <p style={{color:"#9ca3af",fontSize:13,marginBottom:14}}>No voice detected. {attempts<2?"Please try again:":"Rate yourself below:"}</p>
              <button onClick={reset} className="btn-green" style={{width:"100%",fontSize:15,padding:"12px",marginBottom:16}}>🎙️ Try Again</button>
              {attempts>=2&&(
                <>
                  <SelfRate picked={manualScore} onPick={n=>setManualScore(n)} options={[[5,"Read smoothly",5],[4,"Minor pauses",5],[3,"Some difficulty",5],[2,"Significant difficulty",5],[1,"Very hard",5]]}/>
                  {manualScore!==null&&<button className="btn-green" style={{marginTop:12,width:"100%",fontSize:16,padding:"13px"}} onClick={()=>onNext(String(manualScore))}>Next →</button>}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {phase==="analysing"&&(
        <div style={{textAlign:"center",padding:"32px 0"}}>
          <div className="dots"><span/><span/><span/></div>
          <p style={{color:"#6b7280",fontSize:14,marginTop:14}}>Analysing your speech…</p>
        </div>
      )}

      {phase==="complete"&&score!==null&&(
        <div>
          <div style={{background:"rgba(52,211,153,0.06)",border:"1px solid rgba(52,211,153,0.25)",borderRadius:14,padding:"18px",marginBottom:16}}>
            <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:12}}>
              <span style={{fontSize:28,fontWeight:700,color:"#34d399",fontFamily:"monospace",flexShrink:0}}>{score}/5</span>
              <div>
                <p style={{color:"#6ee7b7",fontSize:14,fontWeight:600,marginBottom:3}}>Speech analysis complete</p>
                <p style={{color:"#9ca3af",fontSize:13,lineHeight:1.55}}>{feedback}</p>
              </div>
            </div>
            <div style={{background:"rgba(255,255,255,0.03)",borderRadius:9,padding:"10px 13px"}}>
              <p style={{color:"#6b7280",fontSize:10,fontFamily:"monospace",marginBottom:5}}>YOUR TRANSCRIPT:</p>
              <p style={{color:"#e5e7eb",fontSize:13,fontStyle:"italic"}}>&ldquo;{transcript}&rdquo;</p>
            </div>
          </div>
          <button className="btn-green" style={{width:"100%",fontSize:17,padding:"15px"}} onClick={()=>onNext(String(score))}>Continue →</button>
        </div>
      )}
    </div>
  )
}

function RecallStep({step,onNext}:any) {
  const [val,setVal]=useState("")
  const ref=useRef<HTMLInputElement>(null)
  useEffect(()=>{setVal("");setTimeout(()=>ref.current?.focus(),180)},[step.id])
  return(
    <div>
      <div style={{background:"rgba(99,102,241,0.07)",border:"1px solid rgba(99,102,241,0.2)",borderRadius:12,padding:"12px 16px",marginBottom:16}}>
        <p style={{color:"#a5b4fc",fontSize:13}}>💡 They were 3 simple everyday objects. Type what comes to mind.</p>
      </div>
      <input ref={ref} className="inp" type="text" placeholder={step.placeholder} value={val}
        onChange={e=>setVal(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")onNext(val||"none")}} style={{fontSize:18}}/>
      <button className="btn-green" style={{marginTop:14,width:"100%",fontSize:17,padding:"15px"}} onClick={()=>onNext(val||"none")}>Submit →</button>
    </div>
  )
}

function CuedRecallStep({step,onNext}:any) {
  const [vals,setVals]=useState(["","",""])
  const updateVal=(i:number,v:string)=>setVals(prev=>{const n=[...prev];n[i]=v;return n})
  const result=vals.join(", ")
  return(
    <div>
      <p style={{color:"#9ca3af",fontSize:14,marginBottom:18,lineHeight:1.75}}>{step.subtext}</p>
      <div style={{background:"rgba(99,102,241,0.06)",border:"1px solid rgba(99,102,241,0.2)",borderRadius:14,padding:"20px",marginBottom:20}}>
        <p style={{color:"#a5b4fc",fontSize:12,fontFamily:"monospace",letterSpacing:"0.08em",marginBottom:16}}>YOUR HINTS:</p>
        {step.cues.map((cue:string,i:number)=>(
          <div key={i} style={{marginBottom:16}}>
            <div style={{background:"rgba(99,102,241,0.1)",borderRadius:10,padding:"10px 14px",marginBottom:8}}>
              <p style={{color:"#a5b4fc",fontSize:14}}>Hint {i+1}: <strong>{cue}</strong></p>
            </div>
            <input className="inp" type="text" placeholder={`Type the word that is "${cue}"…`}
              value={vals[i]} onChange={e=>updateVal(i,e.target.value)} style={{fontSize:17}}/>
          </div>
        ))}
      </div>
      <button className="btn-green" style={{width:"100%",fontSize:17,padding:"15px"}} onClick={()=>onNext(result||"none")}>Submit →</button>
    </div>
  )
}

// ═══ BRAIN CARD ═════════════════════════════════════════════════════════════
function BrainCard({label,region,score,max,accent}:{label:string;region:string;score:number;max:number;accent:string}) {
  const pct=Math.round((score/max)*100)
  const status=pct>=80?"Healthy":pct>=50?"Mild concern":"Needs attention"
  const sc=pct>=80?"#10b981":pct>=50?"#f59e0b":"#ef4444"
  return(
    <div style={{background:"rgba(255,255,255,0.03)",border:`1px solid ${sc}22`,borderRadius:13,padding:"13px 14px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
        <div>
          <p style={{fontSize:13,color:"#e5e7eb",fontWeight:600,marginBottom:2}}>{label}</p>
          <p style={{fontSize:10,color:accent,fontFamily:"monospace"}}>{region}</p>
        </div>
        <span style={{fontSize:14,fontWeight:700,color:sc,fontFamily:"monospace"}}>{score}/{max}</span>
      </div>
      <div style={{height:4,background:"rgba(255,255,255,0.07)",borderRadius:3,marginBottom:5}}>
        <div style={{height:"100%",width:`${pct}%`,background:sc,borderRadius:3,transition:"width 1.2s ease"}}/>
      </div>
      <p style={{fontSize:10,color:sc}}>{status}</p>
    </div>
  )
}

// ═══ MAIN APP ═══════════════════════════════════════════════════════════════
export default function Home() {
  const [stepIdx,setStepIdx]=useState(-1)
  const [answers,setAnswers]=useState<Record<string,string>>({})
  const [results,setResults]=useState<ReturnType<typeof computeScore>|null>(null)
  const [aiText,setAiText]=useState("")
  const [aiLoading,setAiLoading]=useState(false)
  const [saving,setSaving]=useState(false)
  const [session,setSession]=useState(()=>buildSteps())
  // Response time tracking
  const stepStartTime=useRef<number>(Date.now())

  const total=session.steps.length
  const step=session.steps[stepIdx]||null
  const isResults=stepIdx>=total

  // Start timer whenever step changes
  useEffect(()=>{
    stepStartTime.current=Date.now()
  },[stepIdx])

  const saveAndNext=async(value:string)=>{
    if(!step)return
    const elapsed=Date.now()-stepStartTime.current
    const next={...answers,[step.id]:value} as Record<string,string>
    // Store response time for this step
    next[`_time_${step.id}`]=String(elapsed)
    if(step.type==="fluency_animals") next["animal_fluency_count"]=value
    if(step.type==="fluency_letter")  next["letter_fluency_count"]=value
    if(step.id==="clock_draw")    next["clock_score"]=value
    if(step.id==="pentagon_draw") next["pentagon_score"]=value
    next["_serial_answers"] = JSON.stringify(session.meta.serialAnswers)
    next["_digit_answers"]  = JSON.stringify(session.meta.digitAnswers)
    next["_word_set"]       = JSON.stringify(session.meta.wordSet.words)
    next["_letter_used"]    = session.meta.letterUsed
    setAnswers(next)
    if(stepIdx+1>=total){await finish(next)}
    else{setStepIdx(i=>i+1)}
  }

  const finish=async(ans:Record<string,string>)=>{
    const res=computeScore(ans)
    setResults(res);setStepIdx(total)
    setAiLoading(true);setSaving(true)
    try{
      const r=await fetch("/api/ai-summary",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({answers:ans,results:res})})
      const data=await r.json()
      setAiText(data.summary||"")
      await supabase.from("screenings").insert({
        patient_name:ans.name,patient_age:parseInt(ans.age||"0"),patient_gender:ans.gender,
        mmse_score:res.mmse,risk_level:res.level,risk_score:res.total,
        clock_score:parseInt(ans.clock_score||"0"),pentagon_score:parseInt(ans.pentagon_score||"0"),
        speech_score:parseInt(ans.speech_record||"0"),memory_recall:ans.memory_recall,
        ai_summary:data.summary||"",answers:ans,completed_at:new Date().toISOString(),
      })
    }catch(e){console.error(e)}
    setAiLoading(false);setSaving(false)
  }

  const restart=()=>{
    setStepIdx(-1)
    setAnswers({})
    setResults(null)
    setAiText("")
    setAiLoading(false)
    setSession(buildSteps())
  }

  const brainScores=results&&answers?(()=>{
    const ss=results.sectionScores||{}
    return{
      memTotal:  ss.memory?.pts||0,      memMax:  ss.memory?.max||16,
      oriPts:    ss.orientation?.pts||0, oriMax:  ss.orientation?.max||5,
      attPts:    ss.attention?.pts||0,   attMax:  ss.attention?.max||9,
      langPts:   ss.language?.pts||0,    langMax: ss.language?.max||18,
      visPts:    ss.visuospatial?.pts||0,visMax:  ss.visuospatial?.max||7,
      spkPts:    ss.speech?.pts||0,      spkMax:  ss.speech?.max||5,
    }
  })():null

  const renderStep=()=>{
    if(!step)return null
    const p={step,onNext:saveAndNext}
    switch(step.type){
      case "prospective_plant": return <ProspectivePlantStep {...p}/>
      case "memory_display":    return <MemoryDisplay {...p}/>
      case "text":              return <TypedInput {...p}/>
      case "number":            return <TypedInput {...p}/>
      case "typed":             return <TypedInput {...p}/>
      case "select":            return <SelectStep {...p}/>
      case "image_name":        return <ImageName {...p}/>
      case "command":           return <CommandStep {...p}/>
      case "textarea":          return <TextareaStep {...p}/>
      case "recall":            return <RecallStep {...p}/>
      case "cued_recall":       return <CuedRecallStep {...p}/>
      case "choice":            return <SelectStep {...p}/>
      case "clock_draw":        return <ClockDrawStep {...p}/>
      case "pentagon_draw":     return <PentagonDrawStep {...p}/>
      case "story_read":        return <StoryReadStep {...p}/>
      case "picture_describe":  return <PictureDescribeStep {...p}/>
      case "speech_record":     return <SpeechRecordStep {...p}/>
      case "digit_span":        return <DigitSpanStep {...p}/>
      case "fluency_animals":   return <FluencyAnimalsStep {...p}/>
      case "fluency_letter":    return <FluencyLetterStep {...p}/>
      default:                  return <TypedInput {...p}/>
    }
  }

  const ss=step?.section?SECTION_STYLE[step.section as keyof typeof SECTION_STYLE]:null

  return(
    <>
      <Head>
        <title>NeuroScreen — Brain Health Check</title>
        <meta name="description" content="Free clinically validated brain health screening"/>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
      </Head>
      <div style={{minHeight:"100vh",background:"#0d1117",display:"flex",flexDirection:"column",alignItems:"center",padding:"28px 18px 80px"}}>
        <div style={{position:"fixed",inset:0,pointerEvents:"none",background:"radial-gradient(ellipse 60% 50% at 10% 5%,rgba(52,211,153,0.05) 0%,transparent 60%),radial-gradient(ellipse 50% 45% at 90% 95%,rgba(99,102,241,0.05) 0%,transparent 60%)"}}/>
        <div className="slide-up" style={{width:"100%",maxWidth:520}}>

          {/* WELCOME */}
          {stepIdx===-1&&(
            <div style={{textAlign:"center",paddingTop:24}}>
              <div style={{fontSize:68,marginBottom:18,display:"inline-block",animation:"pulseglow 2.5s ease infinite"}}>🧠</div>
              <h1 className="font-lora" style={{fontSize:"clamp(28px,6vw,40px)",fontWeight:400,color:"#f9fafb",marginBottom:14,lineHeight:1.2}}>Brain Health Check</h1>
              <p style={{fontSize:17,color:"#9ca3af",maxWidth:390,margin:"0 auto 28px",lineHeight:1.85}}>
                A clinically validated test used by neurologists worldwide. Simple and friendly — anyone can take it.
              </p>
              <div style={{background:"rgba(52,211,153,0.04)",border:"1px solid rgba(52,211,153,0.14)",borderRadius:16,padding:"18px 20px",marginBottom:22,textAlign:"left"}}>
                {[
                  ["🧩","Remember 3 words","Shown to you first — no trick"],
                  ["📍","Answer easy questions","Date, day, city"],
                  ["🔢","Reverse some numbers","Tests working memory — up to 5 digits"],
                  ["🔑","Name 6 objects","From easy to harder — tests word-finding"],
                  ["🐾","Name animals in 60 seconds","Simple and quick"],
                  ["🕐","Draw a clock","AI analyses your drawing"],
                  ["📖","Read and remember a story","4 simple questions after"],
                  ["🎙️","Read one sentence aloud","AI checks your speech"],
                  ["🤖","Get your brain report","AI explains every result in plain words"],
                ].map(([icon,title,desc])=>(
                  <div key={String(title)} style={{display:"flex",alignItems:"flex-start",gap:14,marginBottom:14}}>
                    <span style={{fontSize:20,flexShrink:0,marginTop:1}}>{icon}</span>
                    <div>
                      <p style={{fontSize:14,color:"#e5e7eb",fontWeight:500}}>{title as string}</p>
                      <p style={{fontSize:12,color:"#6b7280",marginTop:2}}>{desc as string}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{display:"inline-flex",alignItems:"center",gap:8,background:"rgba(52,211,153,0.07)",border:"1px solid rgba(52,211,153,0.17)",borderRadius:20,padding:"8px 20px",fontFamily:"monospace",fontSize:11,color:"#6ee7b7",marginBottom:26,letterSpacing:"0.05em"}}>
                ⏱ About 20–25 minutes &nbsp;•&nbsp; No right or wrong answers
              </div><br/>
              <button className="btn-green" style={{fontSize:19,padding:"17px 46px"}} onClick={()=>setStepIdx(0)}>Begin →</button>
              <p style={{color:"#4b5563",fontSize:12,marginTop:16,lineHeight:1.7}}>Your results are private. This is a screening tool — not a medical diagnosis.</p>
            </div>
          )}

          {/* ACTIVE STEP */}
          {stepIdx>=0&&!isResults&&step&&(
            <div key={`step-${stepIdx}`} className="slide-up">
              <ProgressBar current={stepIdx+1} total={total}/>
              {ss&&(
                <div style={{display:"inline-flex",alignItems:"center",gap:6,background:ss.bg,border:`1px solid ${ss.border}`,borderRadius:20,padding:"5px 14px",fontFamily:"monospace",fontSize:10,color:ss.text,letterSpacing:"0.08em",marginBottom:16}}>
                  {step.section.toUpperCase()}
                </div>
              )}
              <p className="font-lora" style={{fontSize:"clamp(19px,3.8vw,25px)",fontWeight:400,color:"#f9fafb",marginBottom:22,lineHeight:1.45}}>
                {step.prompt}
              </p>
              {renderStep()}
            </div>
          )}

          {/* RESULTS */}
          {isResults&&results&&(
            <div key="results" className="slide-up">
              <div style={{textAlign:"center",padding:"30px 24px",borderRadius:20,background:`${results.color}0e`,border:`1px solid ${results.color}26`,marginBottom:18}}>
                <div style={{fontFamily:"monospace",fontSize:9,letterSpacing:"0.15em",textTransform:"uppercase",color:results.color,opacity:0.7,marginBottom:8}}>YOUR BRAIN HEALTH SCREENING RESULT</div>
                <div style={{fontSize:56,marginBottom:8}}>{results.emoji}</div>
                <div className="font-lora" style={{fontSize:32,color:results.color,marginBottom:12}}>{results.level} RISK</div>
                <p style={{fontSize:15,color:results.color,lineHeight:1.8,maxWidth:380,margin:"0 auto"}}>{results.rec}</p>
              </div>

              {results.pattern==="MOOD_RELATED"&&(
                <div style={{background:"rgba(99,102,241,0.07)",border:"1px solid rgba(99,102,241,0.25)",borderRadius:14,padding:"14px 16px",marginBottom:14}}>
                  <p style={{color:"#a5b4fc",fontSize:13,lineHeight:1.7}}>💡 <strong>Pattern note:</strong> Memory improved with cues — this suggests a retrieval issue, not storage damage. This pattern is often related to mood rather than Alzheimer&apos;s.</p>
                </div>
              )}
              {results.pattern==="ALZHEIMERS_PATTERN"&&(
                <div style={{background:"rgba(239,68,68,0.07)",border:"1px solid rgba(239,68,68,0.25)",borderRadius:14,padding:"14px 16px",marginBottom:14}}>
                  <p style={{color:"#fca5a5",fontSize:13,lineHeight:1.7}}>⚠️ <strong>Pattern note:</strong> Memory failed both free and with cues — this encoding failure pattern needs urgent specialist evaluation.</p>
                </div>
              )}

              {brainScores&&(
                <div style={{marginBottom:16}}>
                  <p style={{fontFamily:"monospace",fontSize:9,letterSpacing:"0.1em",textTransform:"uppercase",color:"#6b7280",marginBottom:10}}>🧠 BRAIN REGION ANALYSIS</p>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9}}>
                    <BrainCard label="Memory" region="Hippocampus" score={brainScores.memTotal} max={brainScores.memMax} accent="#a5b4fc"/>
                    <BrainCard label="Orientation" region="Hippocampus + Parietal" score={brainScores.oriPts} max={brainScores.oriMax} accent="#6ee7b7"/>
                    <BrainCard label="Attention" region="Prefrontal Cortex" score={brainScores.attPts} max={brainScores.attMax} accent="#fcd34d"/>
                    <BrainCard label="Language+Naming" region="Temporal + Frontal" score={brainScores.langPts} max={brainScores.langMax} accent="#f9a8d4"/>
                    <BrainCard label="Visuospatial" region="Parietal + Occipital" score={brainScores.visPts} max={brainScores.visMax} accent="#93c5fd"/>
                    <BrainCard label="Speech" region="Broca's Area" score={brainScores.spkPts} max={brainScores.spkMax} accent="#fca5a5"/>
                  </div>
                </div>
              )}

              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:9,marginBottom:16}}>
                {[
                  ["MMSE",`${results.mmse}/30`,results.mmse>=24?"Normal":results.mmse>=18?"Mild":"Low"],
                  ["Clock",`${answers.clock_score||"—"}/5`,"Drawing"],
                  ["Naming",`${[answers.name_pencil,answers.name_watch,answers.name_key,answers.name_scissors,answers.name_thermometer,answers.name_compass].filter(v=>v&&v.length>0).length}/6`,"Objects"],
                  ["Animals",`${results.animals||"—"}`,"Fluency/min"],
                ].map(([label,v,sub])=>(
                  <div key={String(label)} style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:12,padding:"13px 10px",textAlign:"center"}}>
                    <div style={{fontFamily:"monospace",fontSize:8,letterSpacing:"0.1em",textTransform:"uppercase",color:"#6b7280",marginBottom:4}}>{label}</div>
                    <div className="font-lora" style={{fontSize:21,color:"#f9fafb"}}>{v}</div>
                    <div style={{fontSize:10,color:"#6b7280",marginTop:3}}>{sub}</div>
                  </div>
                ))}
              </div>

              {/* Timing summary */}
              {results.slowQuestions&&results.slowQuestions.length>0&&(
                <div style={{background:"rgba(245,158,11,0.06)",border:"1px solid rgba(245,158,11,0.2)",borderRadius:12,padding:"12px 16px",marginBottom:14}}>
                  <p style={{color:"#fcd34d",fontSize:12,lineHeight:1.7}}>
                    ⏱ <strong>Timing note:</strong> {results.slowQuestions.length} question(s) took over 20 seconds. Average response time: {Math.round(results.avgTimeMs/1000)}s. Slow response on cognitive tasks is a separate clinical marker.
                  </p>
                </div>
              )}

              <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:12,padding:"13px 16px",marginBottom:16}}>
                <div style={{fontFamily:"monospace",fontSize:9,letterSpacing:"0.1em",textTransform:"uppercase",color:"#6b7280",marginBottom:5}}>PATIENT</div>
                <div style={{fontSize:17,color:"#f9fafb"}}>{answers.name||"—"}</div>
                <div style={{fontSize:12,color:"#6b7280",marginTop:3}}>Age {answers.age} · {answers.gender}</div>
              </div>

              <div style={{background:"rgba(99,102,241,0.05)",border:"1px solid rgba(99,102,241,0.2)",borderRadius:18,padding:"22px",marginBottom:16}}>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
                  <span style={{fontSize:20}}>🧠</span>
                  <div>
                    <p style={{fontFamily:"monospace",fontSize:9,letterSpacing:"0.12em",textTransform:"uppercase",color:"#818cf8"}}>AI BRAIN HEALTH REPORT</p>
                    <p style={{fontSize:11,color:"#6b7280",marginTop:2}}>Written by AI neurologist • Plain language for everyone</p>
                  </div>
                </div>
                {aiLoading?(
                  <div style={{textAlign:"center",padding:"28px 0"}}>
                    <div className="dots"><span/><span/><span/></div>
                    <p style={{color:"#6b7280",fontSize:14,marginTop:14}}>{saving?"Saving your results…":"AI neurologist is analysing your results…"}</p>
                    <p style={{color:"#4b5563",fontSize:12,marginTop:5}}>Takes about 20 seconds</p>
                  </div>
                ):(
                  <div style={{fontSize:15,lineHeight:1.95,color:"rgba(229,231,235,0.9)",whiteSpace:"pre-wrap"}}>{aiText}</div>
                )}
              </div>

              <div style={{background:"rgba(245,158,11,0.05)",border:"1px solid rgba(245,158,11,0.18)",borderRadius:12,padding:"13px 16px",fontSize:13,color:"rgba(245,158,11,0.85)",lineHeight:1.75,marginBottom:22}}>
                ⚠️ Screening tool only — not a medical diagnosis. Show this report to a qualified doctor.
              </div>
              <button className="btn-green" style={{width:"100%",fontSize:17,padding:"16px"}} onClick={restart}>Take Test Again</button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
