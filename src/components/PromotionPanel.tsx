import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import confetti from "canvas-confetti";

/* ═══════════════════════════════════════════════════════
   DATA
═══════════════════════════════════════════════════════ */

const TRENDING = [
  { tag: "#IPL2025", posts: "24.3K posts" },
  { tag: "#Budget2025", posts: "18.1K posts" },
  { tag: "#Bollywood", posts: "12.8K posts" },
  { tag: "#Cricket", posts: "9.4K posts" },
  { tag: "#TechIndia", posts: "7.2K posts" }
];

const FLOAT_ICONS = ["💬","🔥","🌍","⚡","✨","🏏","🎬","🚀"];

/* ═══════════════════════════════════════════════════════
   HOOKS
═══════════════════════════════════════════════════════ */

function useCountUp(target:number,duration=1800){
  const [count,setCount]=useState(0);
  const rafRef=useRef<number>();

  useEffect(()=>{
    const start=performance.now();

    const animate=(now:number)=>{
      const elapsed=now-start;
      const progress=Math.min(elapsed/duration,1);

      const eased=1-Math.pow(1-progress,3);
      setCount(Math.floor(eased*target));

      if(progress<1){
        rafRef.current=requestAnimationFrame(animate);
      }
    };

    rafRef.current=requestAnimationFrame(animate);

    return()=>{
      if(rafRef.current) cancelAnimationFrame(rafRef.current);
    };

  },[target,duration]);

  return count;
}

function useRotatingPromo(){

  const promos=[
    "Share your thoughts with India 🇮🇳",
    "Start your first viral discussion 🔥",
    "Discover trending voices 🌍",
    "Follow debates that matter ⚡"
  ];

  const [promo,setPromo]=useState(promos[0]);

  useEffect(()=>{
    const interval=setInterval(()=>{
      setPromo(promos[Math.floor(Math.random()*promos.length)]);
    },5000);

    return()=>clearInterval(interval);
  },[]);

  return promo;
}

/* ═══════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════ */

function formatCount(n:number){
  if(n>=1000000) return (n/1000000).toFixed(2)+"M";
  if(n>=1000) return (n/1000).toFixed(1)+"K";
  return String(n);
}

/* ═══════════════════════════════════════════════════════
   FLOATING ICON
═══════════════════════════════════════════════════════ */

function FloatingIcon({emoji,delay,duration,x,y}:{emoji:string,delay:number,duration:number,x:number,y:number}){

  return(
    <span
      className="absolute text-lg pointer-events-none opacity-0"
      style={{
        left:`${x}%`,
        top:`${y}%`,
        animationName:"floatUp",
        animationDuration:`${duration}s`,
        animationDelay:`${delay}s`,
        animationTimingFunction:"ease-in-out",
        animationIterationCount:"infinite"
      }}
    >
      {emoji}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════
   LIVE ACTIVITY FEED
═══════════════════════════════════════════════════════ */

function LiveActivityFeed(){

  const activities=[
    "🔥 Rahul from Delhi joined Sphere",
    "💬 Ananya posted in #TechIndia",
    "⚡ Arjun started a discussion",
    "🏏 New post in #IPL2025",
    "🎬 Bollywood debate trending"
  ];

  const [activity,setActivity]=useState(activities[0]);

  useEffect(()=>{

    const interval=setInterval(()=>{
      const random=activities[Math.floor(Math.random()*activities.length)];
      setActivity(random);
    },4000);

    return()=>clearInterval(interval);

  },[]);

  return(
    <div className="bg-white/10 backdrop-blur-md rounded-lg px-3 py-2 mt-4 text-xs text-white">
      {activity}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════ */

export function PromotionPanel(){

  const navigate=useNavigate();

  const userCount=useCountUp(1240000);
  const rotatingPromo=useRotatingPromo();

  const [btnPulse,setBtnPulse]=useState(false);

  useEffect(()=>{
    const t=setInterval(()=>{
      setBtnPulse(p=>!p);
    },2000);

    return()=>clearInterval(t);
  },[]);

  const handleJoin=()=>{

    confetti({
      particleCount:120,
      spread:70,
      origin:{y:0.7}
    });

    setTimeout(()=>{
      navigate("/login");
    },500);
  };

  return(
    <>
<style>{`

@keyframes floatUp{
0%{transform:translateY(0) scale(.8);opacity:0}
20%{opacity:.7}
80%{opacity:.5}
100%{transform:translateY(-80px) scale(1.1);opacity:0}
}

@keyframes glowPulse{
0%,100%{transform:scale(1);opacity:.35}
50%{transform:scale(1.18);opacity:.55}
}

@keyframes btnShimmer{
0%{background-position:-200% center}
100%{background-position:200% center}
}

`}</style>

<div className="flex flex-col gap-3 w-full">

<div className="relative rounded-2xl overflow-hidden"
style={{background:"linear-gradient(135deg,#1d4ed8 0%,#6d28d9 50%,#be185d 100%)"}}>

<div className="absolute -top-6 -left-6 w-32 h-32 rounded-full bg-white/20"
style={{animation:"glowPulse 3s ease-in-out infinite"}}/>

<div className="absolute -bottom-8 -right-4 w-40 h-40 rounded-full bg-white/10"
style={{animation:"glowPulse 4s ease-in-out infinite"}}/>

<div className="absolute inset-0 overflow-hidden">

{FLOAT_ICONS.map((emoji,i)=>(
<FloatingIcon
key={i}
emoji={emoji}
delay={i*0.7}
duration={3+(i%3)}
x={10+(i*11)%80}
y={60+(i%3)*10}
/>
))}

</div>

<div className="relative z-10 p-5 text-white text-center">

<p className="text-3xl mb-1" style={{fontFamily:"Pacifico"}}>
sphere
</p>

<p className="text-xs text-white/70 mb-4 uppercase">
Your world. Your voice.
</p>

<div className="inline-flex items-center gap-2 bg-white/15 rounded-full px-3 py-1.5 mb-4">

<span className="relative flex h-2 w-2">
<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"/>
<span className="relative inline-flex rounded-full h-2 w-2 bg-green-400"/>
</span>

<span className="text-xs font-bold">
{formatCount(userCount)} voices sharing
</span>

</div>

<p className="text-sm text-white/85 mb-5 leading-relaxed">
{rotatingPromo}
</p>

<button
onClick={handleJoin}
className="w-full py-3 rounded-xl font-bold text-sm text-blue-900"
style={{
background:btnPulse
?"linear-gradient(90deg,#ffffff,#e0e7ff,#ffffff)"
:"linear-gradient(90deg,#e0e7ff,#ffffff,#e0e7ff)",
backgroundSize:"200% auto",
animation:"btnShimmer 3s linear infinite"
}}
>
✨ Join Sphere — It's Free
</button>

<p className="text-[11px] text-white/50 mt-2">
No ads. No spam. Just real voices.
</p>

<LiveActivityFeed/>

</div>
</div>

</div>
</>
);
}