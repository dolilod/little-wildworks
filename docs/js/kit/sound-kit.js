/** THE LITTLE WILDWORKS — quiet synthesized cues. No files or network required. */
export const SOUND_CUES = Object.freeze(['meet','agree','sprout','splash','gust','glimmer','complete']);

/**
 * Create a dormant kit. AudioContext is constructed only by unlock(trustedEvent).
 * Call unlock(event) directly in a genuine click/pointer/keyboard event handler.
 */
export function createSoundKit({ volume=0.22, muted=false, contextFactory }={}) {
  const clamp=v=>Math.max(0,Math.min(0.4,Number.isFinite(Number(v))?Number(v):0.22));
  let level=clamp(volume), silent=Boolean(muted), context=null, master=null, unlocked=false, disposed=false;
  const active=new Set();
  const makeContext=contextFactory||(()=>{
    const C=globalThis.AudioContext||globalThis.webkitAudioContext;
    if(!C) throw new Error('Web Audio is unavailable in this browser.');
    return new C();
  });
  function stopAll() {
    for(const voice of active) { try{voice.stop();}catch{} try{voice.disconnect();}catch{} }
    active.clear();
  }
  async function unlock(event) {
    if(disposed || event?.isTrusted!==true) return false;
    try {
      if(!context) {
        context=makeContext(); master=context.createGain(); master.gain.value=silent?0:level; master.connect(context.destination);
      }
      if(context.state!=='running') await context.resume(); unlocked=context.state==='running'; return unlocked;
    }
    catch { unlocked=false; return false; }
  }
  function tone(start, frequency, duration=0.13, {type='sine', gain=0.14, endFrequency=frequency}={}) {
    const oscillator=context.createOscillator(), envelope=context.createGain();
    oscillator.type=type; oscillator.frequency.setValueAtTime(frequency,start);
    if(endFrequency!==frequency) oscillator.frequency.exponentialRampToValueAtTime(endFrequency,start+duration);
    envelope.gain.setValueAtTime(0.0001,start);
    envelope.gain.exponentialRampToValueAtTime(gain,start+0.012);
    envelope.gain.exponentialRampToValueAtTime(0.0001,start+duration);
    oscillator.connect(envelope); envelope.connect(master); active.add(oscillator);
    oscillator.onended=()=>{active.delete(oscillator);oscillator.disconnect();envelope.disconnect();};
    oscillator.start(start); oscillator.stop(start+duration+0.025);
  }
  function play(cue) {
    if(!SOUND_CUES.includes(cue)) throw new RangeError('Unknown sound cue: '+cue);
    if(disposed || !unlocked || silent || !context || context.state!=='running') return false;
    // Bound overlapping voices when many visual events arrive in one frame.
    if(active.size>20) return false;
    const t=context.currentTime+0.005;
    if(cue==='meet') {tone(t,440,0.14);tone(t+0.11,587.33,0.23);}
    else if(cue==='agree') {tone(t,523.25,0.12,{type:'triangle',gain:0.10});tone(t+0.09,659.25,0.17);}
    else if(cue==='sprout') {tone(t,220,0.24,{type:'triangle',gain:0.10,endFrequency:440});tone(t+0.18,554.37,0.16);}
    else if(cue==='splash') {tone(t,700,0.20,{gain:0.11,endFrequency:280});tone(t+0.10,920,0.15,{gain:0.08,endFrequency:440});}
    else if(cue==='gust') {tone(t,196,0.38,{type:'triangle',gain:0.07,endFrequency:330});tone(t+0.08,294,0.35,{gain:0.05,endFrequency:440});}
    else if(cue==='glimmer') {tone(t,880,0.27,{gain:0.08});tone(t+0.10,1318.51,0.29,{gain:0.05});}
    else if(cue==='complete') [523.25,659.25,783.99,1046.5].forEach((f,i)=>tone(t+i*0.13,f,i===3?0.45:0.21,{gain:0.10}));
    return true;
  }
  function setMuted(value) {
    silent=Boolean(value);
    if(context&&master){master.gain.cancelScheduledValues(context.currentTime);master.gain.setTargetAtTime(silent?0:level,context.currentTime,0.012);}
    if(silent) stopAll(); return silent;
  }
  function setVolume(value) {level=clamp(value);if(context&&master&&!silent)master.gain.setTargetAtTime(level,context.currentTime,0.012);return level;}
  async function suspend() {unlocked=false;stopAll();if(context&&context.state==='running')await context.suspend();}
  async function dispose() {disposed=true;unlocked=false;stopAll();if(context&&context.state!=='closed')await context.close();context=null;master=null;}
  function getState() {return {unlocked,muted:silent,volume:level,contextState:context?.state||'not-created',activeVoices:active.size,disposed};}
  // Game extension: expose the unlocked graph so extra synth layers share the
  // same context, master gain and mute. Returns null until unlock() succeeds.
  function graph() {return (!disposed&&unlocked&&context&&master)?{context,master}:null;}
  return Object.freeze({unlock,play,setMuted,setVolume,suspend,dispose,getState,graph});
}
