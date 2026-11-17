import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, BriefcaseBusiness, CalendarDays, MapPin, Search, SlidersHorizontal, Link2, Download, Trash2, Pencil, X, Check } from "lucide-react";
import { createOpportunity, deleteOpportunity, subscribeToOpportunities, updateOpportunity } from "../firebase/firestore";
import { useAuth } from "../context/useAuth";

const CATEGORIES = ["All", "Inside Bangalore", "Outside Bangalore", "Other"];

function Opportunities(){
  const { role, firebaseUser } = useAuth();
  const isAdmin = role === "admin";
  const [category,setCategory]=useState("All");
  const [q,setQ]=useState("");
  const [items,setItems]=useState([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [url,setUrl]=useState("");
  const [preview,setPreview]=useState(null);
  const [fetching,setFetching]=useState(false);
  const [saving,setSaving]=useState(false);
  const [editing,setEditing]=useState(null);

  useEffect(()=>subscribeToOpportunities((data)=>{setItems(data);setLoading(false)},(err)=>{console.error(err);setError("Opportunities could not be loaded.");setLoading(false)}),[]);

  const list=useMemo(()=>items.filter(x=>(category==="All"||x.category===category)&&`${x.title||""} ${x.org||""} ${x.description||""}`.toLowerCase().includes(q.toLowerCase())),[items,category,q]);

  async function fetchUnstop(){
    const clean=url.trim();
    if(!clean){setError("Paste an Unstop opportunity URL first.");return;}
    if(!/^https?:\/\/(www\.)?unstop\.com\//i.test(clean)){setError("Please paste a public Unstop opportunity URL.");return;}
    setFetching(true);setError("");
    try{
      const token=await firebaseUser.getIdToken();
      const r=await fetch(`/api/unstop/preview?url=${encodeURIComponent(clean)}`,{headers:{Authorization:`Bearer ${token}`}});
      const raw=await r.text();
      let data={};
      try{ data=raw?JSON.parse(raw):{}; }catch{ throw new Error(`Unstop service returned an invalid response (HTTP ${r.status}). Please try again or enter the opportunity details manually.`); }
      if(!r.ok) throw new Error(data.error||`Could not read that Unstop page (HTTP ${r.status}).`);
      setPreview({...data,url:clean,category:data.category||"Other",tag:data.tag||"UNSTOP"});
    }catch(e){setError(e.message||"Could not fetch the Unstop opportunity.")}finally{setFetching(false)}
  }

  async function saveOpportunity(){
    if(!preview?.title||!preview?.url){setError("Title and URL are required.");return;}
    setSaving(true);setError("");
    try{
      const payload={...preview,createdBy:firebaseUser.uid,source:"unstop"};
      if(preview.id) await updateOpportunity(preview.id,payload); else await createOpportunity(payload);
      setPreview(null);setUrl("");setEditing(null);
    }catch(e){setError(e.message||"Could not save opportunity.")}finally{setSaving(false)}
  }

  async function removeOpportunity(id){
    if(!window.confirm("Remove this opportunity from Extra Miler?")) return;
    try{await deleteOpportunity(id)}catch(e){setError(e.message||"Could not remove opportunity.")}
  }

  function editOpportunity(item){setPreview({...item});setEditing(item.id)}

  return <div className="opportunities-page">
    <div className="page-intro"><div><p className="app-kicker">OPPORTUNITY RADAR</p><h1>Go where <span>ideas move.</span></h1><p>Competitions, events, fellowships and rooms worth being in.</p></div><div className="opportunity-count"><strong>{list.length}</strong><span>opportunities</span></div></div>

    {isAdmin && <section className="panel unstop-admin-panel">
      <div className="unstop-admin-copy"><p className="app-kicker">ADMIN · UNSTOP</p><h2>Import an opportunity</h2><p>Paste a public Unstop opportunity link. Extra Miler will fetch the public page details, let you review them, and save the opportunity for everyone.</p></div>
      <div className="unstop-import-row"><div className="task-search"><Link2 size={16}/><input value={url} onChange={e=>setUrl(e.target.value)} onKeyDown={e=>e.key==='Enter'&&fetchUnstop()} placeholder="Paste Unstop opportunity URL..."/></div><button className="primary-app-button" disabled={fetching} onClick={fetchUnstop}>{fetching?<><Download size={15}/> Fetching…</>:<><Download size={15}/> Fetch details</>}</button></div>
    </section>}

    <div className="opportunity-controls"><div className="task-search"><Search size={16}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search opportunities..."/></div><div className="filter-tabs">{CATEGORIES.map(c=><button className={category===c?"active":""} onClick={()=>setCategory(c)} key={c}>{c}</button>)}</div><button className="filter-icon"><SlidersHorizontal size={16}/></button></div>
    {error&&<div className="login-error" role="alert">{error}</div>}
    {loading?<div className="panel loading-panel">Listening for opportunities…</div>:list.length===0?<div className="panel loading-panel">No opportunities added yet. {isAdmin?"Use the Unstop importer above to add one.":"Check back when new opportunities are published."}</div>:<div className="opportunity-grid">{list.map(item=><article className="panel opportunity-card" key={item.id}>
      <div className="opportunity-card-top"><span className="opportunity-tag">{item.tag||"OPPORTUNITY"}</span><ArrowUpRight size={17}/></div><div className="opp-icon">{item.image?<img src={item.image} alt=""/>:<BriefcaseBusiness size={19}/>}</div><h2>{item.title}</h2><p className="opp-org">{item.org||"Unstop"}</p><div className="opp-meta"><span><CalendarDays size={13}/>{item.deadline||item.date||"Deadline TBA"}</span><span><MapPin size={13}/>{item.location||"Online"}</span></div>{item.description&&<p className="opp-description">{item.description}</p>}<div className="opp-footer"><span>{item.category||"Other"}</span><div className="opp-actions"><a href={item.url} target="_blank" rel="noreferrer">View opportunity <ArrowUpRight size={14}/></a>{isAdmin&&<><button onClick={()=>editOpportunity(item)} aria-label="Edit opportunity"><Pencil size={13}/></button><button onClick={()=>removeOpportunity(item.id)} aria-label="Delete opportunity"><Trash2 size={13}/></button></>}</div></div>
    </article>)}</div>}

    {preview&&<div className="review-overlay" role="dialog" aria-modal="true"><div className="panel unstop-preview-modal"><button className="review-close" onClick={()=>{setPreview(null);setEditing(null)}} aria-label="Close"><X size={17}/></button><p className="app-kicker">{editing?"EDIT OPPORTUNITY":"UNSTOP PREVIEW"}</p><h2>Review before publishing</h2><div className="unstop-form-grid"><label>Title<input value={preview.title||""} onChange={e=>setPreview({...preview,title:e.target.value})}/></label><label>Organizer<input value={preview.org||""} onChange={e=>setPreview({...preview,org:e.target.value})}/></label><label>Category<select value={preview.category||"Other"} onChange={e=>setPreview({...preview,category:e.target.value})}>{CATEGORIES.slice(1).map(c=><option key={c}>{c}</option>)}</select></label><label>Deadline<input value={preview.deadline||preview.date||""} onChange={e=>setPreview({...preview,deadline:e.target.value,date:e.target.value})}/></label><label>Location<input value={preview.location||"Online"} onChange={e=>setPreview({...preview,location:e.target.value})}/></label><label>Tag<input value={preview.tag||"UNSTOP"} onChange={e=>setPreview({...preview,tag:e.target.value})}/></label></div><label>Description<textarea rows="5" value={preview.description||""} onChange={e=>setPreview({...preview,description:e.target.value})}/></label><label>Unstop URL<input value={preview.url||""} onChange={e=>setPreview({...preview,url:e.target.value})}/></label><div className="unstop-preview-actions"><button className="ghost-app-button" onClick={()=>{setPreview(null);setEditing(null)}}>Cancel</button><button className="primary-app-button" disabled={saving} onClick={saveOpportunity}><Check size={15}/>{saving?"Saving…":editing?"Save changes":"Publish opportunity"}</button></div></div></div>}
  </div>
}
export default Opportunities;
