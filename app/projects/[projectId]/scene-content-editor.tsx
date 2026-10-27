"use client";
import {useEffect,useRef,useState} from "react";
import {MapPin,UsersRound,Info,Sparkles} from "lucide-react";
type Item={_id:string;name:string;description?:string;appearance?:string;personality?:string;details?:string;notes?:string;weapons?:string;abilities?:string;creatureType?:string;powers?:string;weaknesses?:string};type Kind="characters"|"locations"|"creatures";
function esc(s:string){return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}
function html(s:string){return /data-entity-id=/.test(s)||/<br\s*\/?\s*>|<div\b/i.test(s)?s:esc(s).replace(/\n/g,"<br>");}
export default function SceneContentEditor({value,characters,locations,creatures,onChange}:{value:string;characters:Item[];locations:Item[];creatures:Item[];onChange:(v:string)=>void}){
const ref=useRef<HTMLDivElement>(null);const autoLinkTimer=useRef<ReturnType<typeof setTimeout>|null>(null);const [picker,setPicker]=useState<Kind|null>(null);const [search,setSearch]=useState("");const [details,setDetails]=useState<{item:Item;kind:Kind}|null>(null);
const libraries:Record<Kind,Item[]>={characters,locations,creatures};
useEffect(()=>{if(ref.current&&document.activeElement!==ref.current&&ref.current.innerHTML!==html(value||""))ref.current.innerHTML=html(value||"");},[value]);
useEffect(()=>{
const root=ref.current;if(!root)return;let contentChanged=false;
root.querySelectorAll<HTMLElement>("[data-entity-id][data-entity-type]").forEach(node=>{
const entityType=node.dataset.entityType;const kind:Kind=entityType==="character"?"characters":entityType==="creature"?"creatures":"locations";
const item=libraries[kind].find(entry=>entry._id===node.dataset.entityId);
if(item&&node.textContent!==item.name){node.textContent=item.name;node.dataset.entityName=item.name;contentChanged=true;}
});
if(contentChanged)onChange(root.innerHTML);
},[characters,locations,creatures,onChange]);
function changed(){if(ref.current)onChange(ref.current.innerHTML);}
function autoLinkNames(finalize=false){
const root=ref.current;if(!root)return;
const all=[...characters.map(item=>({item,kind:"characters" as Kind})),...locations.map(item=>({item,kind:"locations" as Kind})),...creatures.map(item=>({item,kind:"creatures" as Kind}))].filter(entry=>entry.item.name.trim()).sort((a,b)=>b.item.name.length-a.item.name.length);
if(!all.length)return;
const names=all.map(entry=>entry.item.name.split("").map(char=>"\\^$.*+?()[]{}|".includes(char)?"\\"+char:char).join(""));
function makeMention"));
const matcher=new RegExp("(?<![\\\\p{L}\\\\p{N}_])(?:"+names.join("|")+")(?![\\\\p{L}\\\\p{N}_])","giu");
const byName=new Map(all.map(entry=>[entry.item.name.toLocaleLowerCase(),entry]));
const selection=window.getSelection();let marker:HTMLSpanElement|null=null;
if(!finalize&&selection?.rangeCount&&root.contains(selection.anchorNode)){
const range=selection.getRangeAt(0);
if(range.collapsed){marker=document.createElement("span");marker.dataset.autolinkCaret="true";marker.setAttribute("aria-hidden","true");range.insertNode(marker);}
}
const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode(node){
const parent=node.parentElement;
if(!parent||parent.closest("[data-entity-id][data-entity-type]")||parent.closest("[data-autolink-caret]"))return NodeFilter.FILTER_REJECT;
return NodeFilter.FILTER_ACCEPT;
}});
const textNodes:Text[]=[];while(walker.nextNode())textNodes.push(walker.currentNode as Text);
let didChange=false;
for(const textNode of textNodes){
const text=textNode.nodeValue||"";matcher.lastIndex=0;let match:RegExpExecArray|null;let last=0;const fragment=document.createDocumentFragment();let foundAny=false;
while((match=matcher.exec(text))!==null){
const found=byName.get(match[0].toLocaleLowerCase());if(!found)continue;
if(match.index>last)fragment.append(document.createTextNode(text.slice(last,match.index)));
fragment.append(makeMention(found.item,found.kind));last=match.index+match[0].length;foundAny=true;
if(matcher.lastIndex===match.index)matcher.lastIndex++;
}
if(foundAny){if(last<text.length)fragment.append(document.createTextNode(text.slice(last)));textNode.replaceWith(fragment);didChange=true;}
}
if(marker?.isConnected){const range=document.createRange();range.setStartBefore(marker);range.collapse(true);marker.remove();selection?.removeAllRanges();selection?.addRange(range);}
if(didChange)changed();
}
function scheduleAutoLink(){if(autoLinkTimer.current)clearTimeout(autoLinkTimer.current);autoLinkTimer.current=setTimeout(()=>autoLinkNames(false),450);}
function makeMention(item:Item,kind:Kind){const node=document.createElement("span");node.className="story-entity-mention";node.contentEditable="false";node.dataset.entityType=kind==="characters"?"character":kind==="creatures"?"creature":"location";node.dataset.entityId=item._id;node.dataset.entityName=item.name;node.title="Click to view saved details";node.textContent=item.name;return node;}
function insert(item:Item,kind:Kind){const root=ref.current;if(!root)return;root.focus();const node=makeMention(item,kind);const sel=window.getSelection();if(sel?.rangeCount&&root.contains(sel.anchorNode)){const range=sel.getRangeAt(0);range.deleteContents();range.insertNode(node);const space=document.createTextNode(" ");node.after(space);range.setStartAfter(space);range.collapse(true);sel.removeAllRanges();sel.addRange(range);}else root.append(node,document.createTextNode(" "));changed();setPicker(null);setSearch("");}
function handlePaste(event:React.ClipboardEvent<HTMLDivElement>){
const root=ref.current;if(!root)return;
const clipboard=event.clipboardData;
const htmlData=clipboard.getData("text/html");
const plainData=clipboard.getData("text/plain");
let plain=plainData;
let sourceHtml="";
if(htmlData){
const parsed=new DOMParser().parseFromString(htmlData,"text/html");
sourceHtml=parsed.body.innerHTML;
if(!plain)plain=parsed.body.textContent||"";
}
if(!plain&&!sourceHtml)return;
event.preventDefault();
const all=[...characters.map(item=>({item,kind:"characters" as Kind})),...locations.map(item=>({item,kind:"locations" as Kind})),...creatures.map(item=>({item,kind:"creatures" as Kind}))].filter(entry=>entry.item.name.trim()).sort((a,b)=>b.item.name.length-a.item.name.length);
const byName=new Map(all.map(entry=>[entry.item.name.toLocaleLowerCase(),entry]));
const fragment=document.createDocumentFragment();
if(sourceHtml&&/data-entity-id\s*=/.test(sourceHtml)){
const parsed=new DOMParser().parseFromString(sourceHtml,"text/html");
const appendNode=(node:Node,parent:Node)=>{
if(node.nodeType===Node.TEXT_NODE){parent.appendChild(document.createTextNode(node.textContent||""));return;}
if(!(node instanceof HTMLElement)){node.childNodes.forEach(child=>appendNode(child,parent));return;}
const id=node.dataset.entityId;const type=node.dataset.entityType;
if(id&&type){
const kind:Kind=type==="character"?"characters":type==="creature"?"creatures":"locations";
const item=libraries[kind].find(entry=>entry._id===id)||byName.get((node.dataset.entityName||node.textContent||"").trim().toLocaleLowerCase())?.item;
if(item){parent.appendChild(makeMention(item,kind));return;}
}
const name=(node.textContent||"").trim();
const match=byName.get(name.toLocaleLowerCase());
if(match&&node.childElementCount===0){parent.appendChild(makeMention(match.item,match.kind));return;}
if(node.tagName==="BR"){parent.appendChild(document.createElement("br"));return;}
if(["DIV","P"].includes(node.tagName)&&parent.hasChildNodes())parent.appendChild(document.createElement("br"));
node.childNodes.forEach(child=>appendNode(child,parent));
if(["DIV","P"].includes(node.tagName))parent.appendChild(document.createElement("br"));
};
parsed.body.childNodes.forEach(node=>appendNode(node,fragment));
}else{
const matcher=all.length?new RegExp(all.map(entry=>entry.item.name.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")).join("|"),"giu"):null;
let last=0;let match:RegExpExecArray|null;
if(matcher){while((match=matcher.exec(plain))!==null){const start=match.index,end=start+match[0].length;
if(start>last)appendPlain(fragment,plain.slice(last,start));
const found=byName.get(match[0].toLocaleLowerCase());
if(found)fragment.append(makeMention(found.item,found.kind));else fragment.append(document.createTextNode(match[0]));
last=end;if(matcher.lastIndex===start)matcher.lastIndex++;
}}
if(last<plain.length)appendPlain(fragment,plain.slice(last));
}
const selection=window.getSelection();let range:Range|undefined;
if(selection?.rangeCount&&root.contains(selection.anchorNode))range=selection.getRangeAt(0);
if(!range){range=document.createRange();range.selectNodeContents(root);range.collapse(false);}
range.deleteContents();const lastNode=fragment.lastChild;range.insertNode(fragment);
if(lastNode){range.setStartAfter(lastNode);range.collapse(true);selection?.removeAllRanges();selection?.addRange(range);}
changed();
}
function appendPlain(parent:DocumentFragment,text:string){const lines=text.split(/\n/);lines.forEach((line,index)=>{if(index)parent.append(document.createElement("br"));if(line)parent.append(document.createTextNode(line));});}
function clickMention(event:React.MouseEvent<HTMLDivElement>){const node=(event.target as HTMLElement).closest<HTMLElement>("[data-entity-id][data-entity-type]");if(!node)return;const kind:Kind=node.dataset.entityType==="character"?"characters":node.dataset.entityType==="creature"?"creatures":"locations";const item=libraries[kind].find(x=>x._id===node.dataset.entityId);if(item)setDetails({item,kind});}
const items=(picker?libraries[picker]:[]).filter(x=>x.name.toLowerCase().includes(search.toLowerCase()));
return <div className="linked-editor-wrap"><div className="linked-editor-tools"><button type="button" onMouseDown={e=>e.preventDefault()} onClick={()=>{setPicker(picker==="characters"?null:"characters");setSearch("");}}><UsersRound size={14}/> Insert character</button><button type="button" onMouseDown={e=>e.preventDefault()} onClick={()=>{setPicker(picker==="locations"?null:"locations");setSearch("");}}><MapPin size={14}/> Insert location</button><button type="button" onMouseDown={e=>e.preventDefault()} onClick={()=>{setPicker(picker==="creatures"?null:"creatures");setSearch("");}}><Sparkles size={14}/> Insert creature</button><span>Inserted names remain linked to their library records</span></div>
{picker&&<div className="mention-picker"><div className="mention-picker-head"><strong>{picker==="characters"?"Insert a character":picker==="creatures"?"Insert a creature":"Insert a location"}</strong><button type="button" onClick={()=>setPicker(null)}>Close</button></div><input aria-label="Search library" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by name…"/><div className="mention-picker-list">{items.map(item=><button type="button" key={item._id} onMouseDown={e=>e.preventDefault()} onClick={()=>insert(item,picker)}><span>{item.name}</span><small>{item.description||item.appearance||item.details||"Saved library entry"}</small></button>)}{!items.length&&<p>No matches found.</p>}</div></div>}
<div ref={ref} className="scene-editor linked-scene-editor" contentEditable suppressContentEditableWarning role="textbox" aria-label="Scene content" aria-multiline="true" data-placeholder="The scene begins… Describe what we see, what the characters do, and what they say." onInput={()=>{changed();scheduleAutoLink();}} onBlur={()=>autoLinkNames(true)} onPaste={handlePaste} onClick={clickMention}/><div className="linked-editor-hint"><Info size={12}/> Click a highlighted name to view its saved details.</div>
{details&&<div className="entity-detail-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setDetails(null);}}><section className="entity-detail-card" role="dialog" aria-modal="true" aria-label={details.item.name+" details"}><div className="entity-detail-top"><div><small>{details.kind==="characters"?"CHARACTER PROFILE":details.kind==="creatures"?"CREATURE PROFILE":"LOCATION PROFILE"}</small><h3>{details.item.name}</h3></div><button type="button" onClick={()=>setDetails(null)}>Close</button></div><p>{details.item.description||"No overview added yet."}</p>{(details.kind==="characters"?[["Appearance",details.item.appearance],["Personality",details.item.personality],["Weapons",details.item.weapons],["Abilities",details.item.abilities]]:details.kind==="creatures"?[["Creature type",details.item.creatureType],["Abilities",details.item.abilities],["Powers",details.item.powers],["Weaknesses",details.item.weaknesses]]:[["Location details",details.item.details]]).map(([label,text])=><div key={label}><h4>{label}</h4><p>{text||"No details added."}</p></div>)}{details.item.notes&&<><h4>Notes</h4><p>{details.item.notes}</p></>}</section></div>}</div>;
}