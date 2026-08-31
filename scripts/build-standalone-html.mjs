import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';

const root = process.cwd();
const assets = path.join(root, 'attached_assets');

const militaryKeywords = [
  'air force base','afb','air force','army','aaf','army airfield','navy','nas','naval',
  'marine','mcas','marine corps','coast guard','uscg','joint base','military',
  'air national guard','ang','air natl guard'
];
const isMilitary = name => militaryKeywords.some(k => String(name || '').toLowerCase().includes(k));

const airportCsv = fs.readFileSync(path.join(assets, 'NTAD_Aviation_Facilities_7163558772200366310_1759859539047.csv'), 'utf8');
const airportRows = parse(airportCsv, { columns: true, skip_empty_lines: true, trim: true, relax_quotes: true, relax_column_count: true });
const airports = airportRows
  .filter(r => r.STATE_CODE === 'WA' && r.FACILITY_USE_CODE === 'PU' && r.SITE_TYPE_CODE === 'A' && !isMilitary(r.ARPT_NAME))
  .map(r => ({
    ident: r.ARPT_ID,
    name: r.ARPT_NAME,
    latitude_deg: Number(r.LAT_DECIMAL),
    longitude_deg: Number(r.LONG_DECIMAL),
    elevation_ft: r.ELEV === '' || r.ELEV == null ? null : Number(r.ELEV),
    local_code: r.ARPT_ID
  }))
  .filter(a => Number.isFinite(a.latitude_deg) && Number.isFinite(a.longitude_deg));

const runwayEnds = JSON.parse(fs.readFileSync(path.join(assets, 'wa_nasr_rwy_ends.json'), 'utf8'));
const runways = JSON.parse(fs.readFileSync(path.join(assets, 'wa_nasr_runways.json'), 'utf8'));
const approachCsv = fs.readFileSync(path.join(assets, 'runway_approach_types.final_1759859516606.csv'), 'utf8');
const approachRows = parse(approachCsv, { columns: true, skip_empty_lines: true, trim: true });
const approaches = approachRows
  .filter(r => r.AirportID && r.RunwayEnd && r.Category)
  .map(r => [String(r.AirportID) + '-' + String(r.RunwayEnd), String(r.Category)]);

const safeJson = obj => JSON.stringify(obj).replace(/</g, '\\u003c');

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Aviation Obstacle Analysis - Standalone</title>
<style>
:root{font-family:Segoe UI,Arial,sans-serif;color:#17202a;background:#f4f6f8}*{box-sizing:border-box}body{margin:0}.wrap{max-width:1280px;margin:0 auto;padding:24px}.hero{background:#fff;border:1px solid #d9e0e6;border-radius:12px;padding:22px;margin-bottom:18px}.hero h1{margin:0 0 6px;font-size:27px}.hero p{margin:4px 0;color:#52606d}.badge{display:inline-block;padding:4px 9px;border-radius:999px;background:#e8f1fb;color:#174a7e;font-size:12px;font-weight:700}.panel{background:#fff;border:1px solid #d9e0e6;border-radius:12px;padding:18px;margin-bottom:18px}textarea{width:100%;min-height:240px;resize:vertical;border:1px solid #aeb8c2;border-radius:8px;padding:12px;font:13px Consolas,monospace}.row{display:flex;gap:10px;flex-wrap:wrap;margin-top:12px}button,.filelabel{border:0;border-radius:7px;padding:10px 14px;font-weight:700;cursor:pointer;background:#174a7e;color:white}.secondary{background:#5f6b76}.ghost{background:#e9eef2;color:#27313a}.filelabel input{display:none}.summary{display:flex;gap:10px;flex-wrap:wrap;margin:12px 0}.stat{background:#eef3f7;border-radius:8px;padding:8px 11px;font-size:13px}.error{display:none;background:#fdecec;border:1px solid #e4a4a4;color:#7a1d1d;padding:12px;border-radius:8px;margin-top:12px;white-space:pre-wrap}.notice{background:#fff7dd;border:1px solid #ead18b;border-radius:8px;padding:10px 12px;margin-top:12px;font-size:13px;color:#5f4b13}.tablewrap{overflow:auto}table{width:100%;border-collapse:collapse;font-size:13px}th,td{text-align:left;padding:9px 8px;border-bottom:1px solid #e2e7eb;white-space:nowrap}th{background:#f3f6f8;position:sticky;top:0}.pill{padding:3px 7px;border-radius:999px;font-weight:700;font-size:11px;text-transform:uppercase}.clear{background:#e7f5ea;color:#20652d}.warning{background:#fff0c8;color:#7b5600}.penetration{background:#fde2e2;color:#8e1b1b}.muted{color:#67727d;font-size:12px}.hidden{display:none}@media(max-width:700px){.wrap{padding:12px}.hero h1{font-size:22px}}
</style>
</head>
<body>
<div class="wrap">
  <div class="hero">
    <span class="badge">OFFLINE STANDALONE</span>
    <h1>Aviation Obstacle Analysis</h1>
    <p>Washington Part 77 planning-screening tool. Paste FAA OE/AAA search results directly.</p>
    <p class="muted">Build: standalone-oeaaa-v4 | Embedded airport and runway data come from the same repository datasets used by the self-hosted application.</p>
  </div>

  <div class="panel">
    <label for="input"><strong>FAA OE/AAA results or obstacle rows</strong></label>
    <textarea id="input" placeholder="Paste FAA OE/AAA results here..."></textarea>
    <div class="row">
      <button id="analyze">Analyze obstacles</button>
      <button id="clear" class="secondary">Clear</button>
      <button id="export" class="ghost" disabled>Export CSV</button>
      <label class="filelabel">Open TXT/CSV<input id="file" type="file" accept=".txt,.csv,text/plain,text/csv"></label>
    </div>
    <div id="error" class="error"></div>
    <div class="notice">Planning/screening use only. This is not an FAA aeronautical determination and does not replace filing or FAA review where required.</div>
  </div>

  <div id="resultsPanel" class="panel hidden">
    <div id="summary" class="summary"></div>
    <div class="tablewrap">
      <table>
        <thead><tr><th>Obstacle</th><th>Status</th><th>Controlling airport</th><th>Distance NM</th><th>Surface</th><th>AGL ft</th><th>Top MSL ft</th><th>Penetration ft</th><th>Approach</th><th>Lat</th><th>Lon</th></tr></thead>
        <tbody id="tbody"></tbody>
      </table>
    </div>
  </div>
</div>
<script>
'use strict';
const AIRPORTS=${safeJson(airports)};
const RUNWAY_ENDS=${safeJson(runwayEnds)};
const RUNWAYS=${safeJson(runways)};
const APPROACH_PAIRS=${safeJson(approaches)};
const APPROACH_TYPES=new Map(APPROACH_PAIRS);
const ENDS_BY_AIRPORT=new Map();
const RUNWAYS_BY_AIRPORT=new Map();
for(const e of RUNWAY_ENDS){if(!ENDS_BY_AIRPORT.has(e.arptId))ENDS_BY_AIRPORT.set(e.arptId,[]);ENDS_BY_AIRPORT.get(e.arptId).push(e)}
for(const r of RUNWAYS){if(!RUNWAYS_BY_AIRPORT.has(r.arptId))RUNWAYS_BY_AIRPORT.set(r.arptId,[]);RUNWAYS_BY_AIRPORT.get(r.arptId).push(r)}

function normalizeText(v){return String(v).replace(/\\r\\n?/g,'\\n').replace(/\\u00a0/g,' ').replace(/[º]/g,'°').replace(/[′’`]/g,"'").replace(/[″”]/g,'"')}
function dmsPartsToDecimal(d,m,s,dir){if(![d,m,s].every(Number.isFinite)||m<0||m>=60||s<0||s>=60)return null;const max=/[NS]/i.test(dir)?90:180;if(d<0||d>max)return null;let x=d+m/60+s/3600;if(/[SW]/i.test(dir))x=-x;return x}
function coordinateFromText(value,latitude){const n=normalizeText(value).trim();const h=latitude?'NS':'EW';const pats=[new RegExp('(\\\\d{1,3})\\\\s*(?:°|-)\\\\s*(\\\\d{1,2})\\\\s*(?:\\\'|-)\\\\s*(\\\\d{1,2}(?:\\\\.\\\\d+)?)\\\\s*(?:")?\\\\s*(['+h+'])','i'),new RegExp('(\\\\d{1,3})\\\\s+(\\\\d{1,2})\\\\s+(\\\\d{1,2}(?:\\\\.\\\\d+)?)\\\\s*(['+h+'])','i')];for(const p of pats){const m=n.match(p);if(m){const x=dmsPartsToDecimal(Number(m[1]),Number(m[2]),Number(m[3]),m[4]);if(x!==null)return x}}const hd=n.match(new RegExp('(-?\\\\d{1,3}(?:\\\\.\\\\d+)?)\\\\s*°?\\\\s*(['+h+'])','i'));if(hd){let x=Math.abs(Number(hd[1]));const max=latitude?90:180;if(!Number.isFinite(x)||x>max)return null;if(/[SW]/i.test(hd[2]))x=-x;return x}if(/^-?\\d{1,3}(?:\\.\\d+)?$/.test(n)){const x=Number(n),max=latitude?90:180;if(Number.isFinite(x)&&x>=-max&&x<=max)return x}return null}
function findHemisphereCoordinate(text,latitude,startAt=0){const source=normalizeText(text).slice(startAt),h=latitude?'NS':'EW';const pats=[new RegExp('(\\\\d{1,3})\\\\s*(?:°|-)\\\\s*(\\\\d{1,2})\\\\s*(?:\\\'|-)\\\\s*(\\\\d{1,2}(?:\\\\.\\\\d+)?)\\\\s*(?:")?\\\\s*(['+h+'])','i'),new RegExp('(\\\\d{1,3})\\\\s+(\\\\d{1,2})\\\\s+(\\\\d{1,2}(?:\\\\.\\\\d+)?)\\\\s*(['+h+'])','i'),new RegExp('(-?\\\\d{1,3}(?:\\\\.\\\\d+)?)\\\\s*°?\\\\s*(['+h+'])','i')];for(const p of pats){const m=source.match(p);if(!m||m.index===undefined)continue;const value=coordinateFromText(m[0],latitude);if(value===null)continue;const index=startAt+m.index;return{value,index,end:index+m[0].length,raw:m[0]}}return null}
function stripMarkdownLinks(t){return t.replace(/\\[([^\\]]+)\\]\\([^\\n)]+\\)/g,'$1')}
function collectUniqueAsnStarts(text){const re=/\\b(\\d{4}-[A-Z0-9]{3,4}-\\d+-[A-Z0-9]+)\\b/gi,out=[];let m;while((m=re.exec(text))!==null){const asn=m[1].toUpperCase(),prev=out[out.length-1];if(prev&&prev.asn===asn)continue;out.push({index:m.index,end:m.index+m[0].length,asn})}return out}
function extractStatus(body){const m=body.match(/Determined\\s*-\\s*(?:No\\s+Hazard|Hazard)|Determined|Pending|Evaluating|Studying|Circularized|Withdrawn|Terminated/iu);return m?m[0].replace(/\\s+/g,' ').trim():''}
function detectStructure(body,latIndex){const b=body.slice(0,latIndex).toLowerCase(),s=['Mobile Construction Equipment','Transmission Line Tower','Mobile Crane','Building','Parking','Crane','Pole','Tower'];return s.find(x=>b.includes(x.toLowerCase()))}
function parseOeaaaClipboard(text){const n=stripMarkdownLinks(normalizeText(text)),starts=collectUniqueAsnStarts(n);if(!starts.length)return null;const obstacles=[],unparsed=[];let skipped=0;for(let i=0;i<starts.length;i++){const st=starts[i],end=i+1<starts.length?starts[i+1].index:n.length,body=n.slice(st.end,end),status=extractStatus(body);if(/determined/i.test(status)||/\\bDetermined\\b/i.test(body)){skipped++;continue}const lat=findHemisphereCoordinate(body,true),lon=lat?findHemisphereCoordinate(body,false,lat.end):null;if(!lat||!lon){unparsed.push({lineNumber:i+1,text:st.asn+': latitude/longitude not found'});continue}const nums=Array.from(body.slice(lon.end).matchAll(/[-+]?\\d+(?:\\.\\d+)?/g)).map(x=>Number(x[0])).filter(Number.isFinite),site=nums[0],agl=nums[1];if(!Number.isFinite(site)||!Number.isFinite(agl)){unparsed.push({lineNumber:i+1,text:st.asn+': Elevation/AGL not found after longitude'});continue}obstacles.push({id:String(i+1),obstacleId:st.asn,latitude:lat.value,longitude:lon.value,heightMSL:site+agl,heightAGL:agl,type:detectStructure(body,lat.index),status})}return{obstacles,unparsedLines:unparsed,skippedDetermined:skipped,sourceFormat:'oeaaa-table',detectedAsnCount:starts.length}}
function parseRow(line,index){const n=normalizeText(line).trim();if(!n||(/latitude/i.test(n)&&/longitude/i.test(n))||/determined/i.test(n))return null;const lat=findHemisphereCoordinate(n,true),lon=lat?findHemisphereCoordinate(n,false,lat.end):null;let latitude=null,longitude=null,end=-1;if(lat&&lon){latitude=lat.value;longitude=lon.value;end=lon.end}else{const m=n.match(/(-?\\d{1,2}(?:\\.\\d+))\\s*[,;\\t| ]+\\s*(-?\\d{1,3}(?:\\.\\d+))/);if(m&&m.index!==undefined){latitude=coordinateFromText(m[1],true);longitude=coordinateFromText(m[2],false);end=m.index+m[0].length}}if(latitude===null||longitude===null||end<0)return null;const nums=Array.from(n.slice(end).matchAll(/-?\\d+(?:\\.\\d+)?/g)).map(x=>Number(x[0]));let msl=0,agl=0;if(nums.length>=2){msl=nums[nums.length-2];agl=nums[nums.length-1]}else if(nums.length===1)agl=nums[0];const obstacleId=n.split(/[,;\\t|\\s]+/)[0]||('OBS-'+(index+1));return{id:String(index+1),obstacleId,latitude,longitude,heightMSL:msl,heightAGL:agl,status:''}}
function parseRows(text){const obstacles=[],unparsed=[];let skipped=0;normalizeText(text).split('\\n').forEach((line,i)=>{const t=line.trim();if(!t)return;if(/determined/i.test(t)){skipped++;return}if(/latitude/i.test(t)&&/longitude/i.test(t))return;const p=parseRow(t,i);if(p)obstacles.push(p);else unparsed.push({lineNumber:i+1,text:t.slice(0,180)})});return{obstacles,unparsedLines:unparsed,skippedDetermined:skipped,sourceFormat:'rows',detectedAsnCount:0}}
function parseObstacleText(text){return parseOeaaaClipboard(text)||parseRows(text)}

function rad(d){return d*Math.PI/180}function haversine(lat1,lon1,lat2,lon2){const R=3440.065,dLat=rad(lat2-lat1),dLon=rad(lon2-lon1),a=Math.sin(dLat/2)**2+Math.cos(rad(lat1))*Math.cos(rad(lat2))*Math.sin(dLon/2)**2;return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a))}
function nearestAirport(o){let best=null,dist=Infinity;for(const a of AIRPORTS){const d=haversine(o.latitude,o.longitude,a.latitude_deg,a.longitude_deg);if(d<dist){dist=d;best=a}}return best?{airport:best,distance:Number(dist.toFixed(2))}:null}
function airportsWithin(o,r=10){return AIRPORTS.map(a=>({airport:a,distance:haversine(o.latitude,o.longitude,a.latitude_deg,a.longitude_deg)})).filter(x=>x.distance<=r).sort((a,b)=>a.distance-b.distance).map(x=>({airport:x.airport,distance:Number(x.distance.toFixed(2))}))}

const FT_PER_DEG_LAT=364566,HORIZONTAL_SURFACE_HEIGHT=150,PRIMARY_EXTENSION_FT=200;
function latLonToFt(fromLat,fromLon,toLat,toLon){const f=FT_PER_DEG_LAT*Math.cos(fromLat*Math.PI/180);return{dx:(toLon-fromLon)*f,dy:(toLat-fromLat)*FT_PER_DEG_LAT}}
function headingToVec(h){const r=h*Math.PI/180;return{ex:Math.sin(r),ey:Math.cos(r)}}
function projectOntoApproach(obsLat,obsLon,thLat,thLon,hdg){const p=latLonToFt(thLat,thLon,obsLat,obsLon),v=headingToVec(hdg);return{along:p.dx*v.ex+p.dy*v.ey,lateral:Math.abs(p.dx*v.ey-p.dy*v.ex)}}
function distToSegmentFt(obsLat,obsLon,aLat,aLon,bLat,bLon){const p=latLonToFt(aLat,aLon,obsLat,obsLon),v=latLonToFt(aLat,aLon,bLat,bLon),ls=v.dx*v.dx+v.dy*v.dy,t=ls>0?Math.max(0,Math.min(1,(p.dx*v.dx+p.dy*v.dy)/ls)):0,ex=p.dx-t*v.dx,ey=p.dy-t*v.dy;return{dist:Math.sqrt(ex*ex+ey*ey),t}}
function getApproachParams(t){if(t==='UTILITY')return{length:5000,innerHalfWidth:250,outerHalfWidth:750,expansion:500/5000};if(t==='VISUAL')return{length:5000,innerHalfWidth:500,outerHalfWidth:750,expansion:250/5000};if(t==='PREC')return{length:50000,innerHalfWidth:500,outerHalfWidth:8000,expansion:7500/50000};return{length:10000,innerHalfWidth:500,outerHalfWidth:2000,expansion:1500/10000}}
function approachHeightAtDist(d,t){if(d<=0)return 0;if(t==='UTILITY'||t==='VISUAL')return d>5000?null:d/20;if(t==='PREC'){if(d>50000)return null;return d<=10000?d/50:200+(d-10000)/40}return d>10000?null:d/34}
const SEV={'Primary Surface':5,'Approach Surface':4,'Transitional Surface':3,'Horizontal Surface':2,'Conical Surface':1};
function worse(a,b){if(!a)return b;if(!a.penetrates&&!b.penetrates)return a;if(!a.penetrates)return b;if(!b.penetrates)return a;const ad=a.penetrationHeight||0,bd=b.penetrationHeight||0;if(bd>ad)return b;if(ad>bd)return a;return(SEV[b.surfaceType]||0)>=(SEV[a.surfaceType]||0)?b:a}
function getRunwayApproachType(id,end){return APPROACH_TYPES.get(id+'-'+end)||null}
function getBestApproachTypeForAirport(id){const rank={VISUAL:0,UTILITY:1,NONPREC:2,PREC:3};let best=null;for(const [k,v] of APPROACH_TYPES){if(!k.startsWith(id+'-'))continue;if(v==='PREC')return'PREC';if(best===null||rank[v]>rank[best])best=v}return best}
function endApproachType(id,end,ils,utility){if(utility)return'UTILITY';if(ils&&/\\b(ILS|MLS|GLS)\\b/i.test(ils))return'PREC';return getRunwayApproachType(id,end)||'NONPREC'}
function moreRestrictive(a,b){const r={VISUAL:0,UTILITY:1,NONPREC:2,PREC:3};return(r[b]||0)>(r[a]||0)?b:a}
function radialFallback(o,a,dFt,rel){const best=getBestApproachTypeForAirport(a.ident)||'NONPREC',hr=(best==='VISUAL'||best==='UTILITY')?5000:10000,cr=hr+4000;let pen=null;const ad=Math.max(0,dFt-2500),ah=approachHeightAtDist(ad,best);if(ah!==null&&rel>ah)pen=worse(pen,{penetrates:true,surfaceType:'Approach Surface',penetrationHeight:rel-ah});if(dFt<hr&&rel>150)pen=worse(pen,{penetrates:true,surfaceType:'Horizontal Surface',penetrationHeight:rel-150});if(dFt>=hr&&dFt<cr){const h=150+(dFt-hr)/20;if(rel>h)pen=worse(pen,{penetrates:true,surfaceType:'Conical Surface',penetrationHeight:rel-h})}return{penetration:pen||{penetrates:false,surfaceType:'Horizontal Surface'},airportBestApproachType:best,horizontalRadiusFt:hr,conicalOuterRadiusFt:cr}}
function analyzePart77(o,a,dNM){const dFt=dNM*6076.12,rel=(o.heightMSL||0)-(a.elevation_ft||0),obsLat=o.latitude,obsLon=o.longitude,ends=ENDS_BY_AIRPORT.get(a.ident)||[],lens=RUNWAYS_BY_AIRPORT.get(a.ident)||[],rmap=new Map();for(const r of lens)rmap.set(r.rwdId,{lengthFt:r.lengthFt,ends:[]});for(const e of ends){if(!rmap.has(e.rwdId))rmap.set(e.rwdId,{lengthFt:null,ends:[]});rmap.get(e.rwdId).ends.push(e)}if(!rmap.size)return radialFallback(o,a,dFt,rel);let bestPen=null,bestApproach='VISUAL';for(const rec of rmap.values()){if(rec.ends.length<2)continue;const utility=rec.lengthFt!==null&&rec.lengthFt>0&&rec.lengthFt<3200,primaryHW=utility?250:500,e1=rec.ends[0],e2=rec.ends[1];if(e1.lat&&e2.lat){const q=distToSegmentFt(obsLat,obsLon,e1.lat,e1.lon,e2.lat,e2.lon);if(q.t>=0&&q.t<=1){if(q.dist<=primaryHW&&rel>0)bestPen=worse(bestPen,{penetrates:true,surfaceType:'Primary Surface',penetrationHeight:rel});else if(rel>0&&rel<150){const th=(q.dist-primaryHW)/7;if(rel>th)bestPen=worse(bestPen,{penetrates:true,surfaceType:'Transitional Surface',penetrationHeight:rel-th})}}}for(const e of rec.ends){if(e.trueAlignment===null)continue;const hdg=(e.trueAlignment+180)%360,type=endApproachType(a.ident,e.endId,e.ilsType,utility);bestApproach=moreRestrictive(bestApproach,type);const p=getApproachParams(type),q=projectOntoApproach(obsLat,obsLon,e.lat,e.lon,hdg);if(q.along>=0&&q.along<=200){if(q.lateral<=primaryHW&&rel>0)bestPen=worse(bestPen,{penetrates:true,surfaceType:'Primary Surface',penetrationHeight:rel});else if(rel>0&&rel<150){const th=(q.lateral-primaryHW)/7;if(rel>th)bestPen=worse(bestPen,{penetrates:true,surfaceType:'Transitional Surface',penetrationHeight:rel-th})}}const ad=q.along-200;if(ad>=0&&ad<=p.length){const hw=p.innerHalfWidth+ad*p.expansion,sh=approachHeightAtDist(ad,type);if(sh!==null){if(q.lateral<=hw&&rel>sh)bestPen=worse(bestPen,{penetrates:true,surfaceType:'Approach Surface',penetrationHeight:rel-sh});else if(q.lateral>hw&&rel>0&&rel<150){const th=(q.lateral-hw)/7;if(rel>th)bestPen=worse(bestPen,{penetrates:true,surfaceType:'Transitional Surface',penetrationHeight:rel-th})}}}}}
const hr=(bestApproach==='VISUAL'||bestApproach==='UTILITY')?5000:10000;let inside=false;for(const rec of rmap.values()){if(rec.ends.length<2)continue;if(distToSegmentFt(obsLat,obsLon,rec.ends[0].lat,rec.ends[0].lon,rec.ends[1].lat,rec.ends[1].lon).dist<=hr){inside=true;break}}if(!inside){outer:for(const rec of rmap.values())for(const e of rec.ends){const p=latLonToFt(e.lat,e.lon,obsLat,obsLon);if(Math.hypot(p.dx,p.dy)<=hr){inside=true;break outer}}}if(inside&&rel>150)bestPen=worse(bestPen,{penetrates:true,surfaceType:'Horizontal Surface',penetrationHeight:rel-150});const cr=hr+4000;if(!inside&&dFt<cr){const h=150+Math.max(0,dFt-hr)/20;if(rel>h)bestPen=worse(bestPen,{penetrates:true,surfaceType:'Conical Surface',penetrationHeight:rel-h})}return{penetration:bestPen||{penetrates:false,surfaceType:'Horizontal Surface'},airportBestApproachType:bestApproach,horizontalRadiusFt:hr,conicalOuterRadiusFt:cr}}
function statusOf(p){if(!p.penetrates)return'clear';return(p.penetrationHeight||0)>25?'penetration':'warning'}
function createResult(o,a,d,i){const x=analyzePart77(o,a,d),p=x.penetration;return{id:String(i+1),obstacleId:o.obstacleId,nearestAirport:a.local_code||a.ident,airportName:a.name,airportLatitude:a.latitude_deg,airportLongitude:a.longitude_deg,distance:d,obstacleHeight:o.heightAGL||0,obstacleHeightMSL:o.heightMSL||0,surfaceType:p.surfaceType,status:statusOf(p),penetrationHeight:p.penetrationHeight,latitude:o.latitude,longitude:o.longitude,horizontalRadiusFt:x.horizontalRadiusFt,conicalOuterRadiusFt:x.conicalOuterRadiusFt,approachType:x.airportBestApproachType}}
function pickWorst(rs){const rank={clear:0,warning:1,penetration:2};return rs.reduce((w,r)=>{if(rank[r.status]>rank[w.status])return r;if(rank[r.status]<rank[w.status])return w;const wd=w.penetrationHeight||0,rd=r.penetrationHeight||0;if(rd>wd)return r;if(rd<wd)return w;return r.distance<w.distance?r:w})}
function analyzeText(text){const parsed=parseObstacleText(text);if(!parsed.obstacles.length)throw new Error(parsed.sourceFormat==='oeaaa-table'?('No active obstacles found. Detected '+parsed.detectedAsnCount+' ASN record(s), skipped '+parsed.skippedDetermined+' Determined record(s), '+parsed.unparsedLines.length+' unparsed record(s).'):'No obstacle records were recognized.');const results=[];for(let i=0;i<parsed.obstacles.length;i++){let o=parsed.obstacles[i],near=nearestAirport(o);if(!near)continue;if((!o.heightMSL||o.heightMSL===0)&&o.heightAGL)o=Object.assign({},o,{heightMSL:o.heightAGL+(near.airport.elevation_ft||0)});let nearby=airportsWithin(o,10);if(!nearby.some(x=>x.airport.ident===near.airport.ident))nearby=[near].concat(nearby);const candidates=nearby.map(x=>createResult(o,x.airport,x.distance,i));if(candidates.length)results.push(pickWorst(candidates))}return{parsed,results}}

let current=[];
const input=document.getElementById('input'),err=document.getElementById('error'),panel=document.getElementById('resultsPanel'),tbody=document.getElementById('tbody'),summary=document.getElementById('summary'),exportBtn=document.getElementById('export');
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function fmt(v,d=1){return Number.isFinite(Number(v))?Number(v).toFixed(d):''}
function showError(e){err.textContent=e;err.style.display='block'}function hideError(){err.style.display='none';err.textContent=''}
function render(out){current=out.results;summary.innerHTML='<div class="stat"><b>'+out.results.length+'</b> analyzed</div><div class="stat"><b>'+out.parsed.detectedAsnCount+'</b> FAA ASN detected</div><div class="stat"><b>'+out.parsed.skippedDetermined+'</b> Determined skipped</div><div class="stat"><b>'+out.parsed.unparsedLines.length+'</b> unparsed</div>';tbody.innerHTML=out.results.map(r=>'<tr><td>'+esc(r.obstacleId)+'</td><td><span class="pill '+esc(r.status)+'">'+esc(r.status)+'</span></td><td><b>'+esc(r.nearestAirport)+'</b> '+esc(r.airportName)+'</td><td>'+fmt(r.distance,2)+'</td><td>'+esc(r.surfaceType)+'</td><td>'+fmt(r.obstacleHeight,0)+'</td><td>'+fmt(r.obstacleHeightMSL,0)+'</td><td>'+fmt(r.penetrationHeight,1)+'</td><td>'+esc(r.approachType)+'</td><td>'+fmt(r.latitude,6)+'</td><td>'+fmt(r.longitude,6)+'</td></tr>').join('');panel.classList.remove('hidden');exportBtn.disabled=!out.results.length}
document.getElementById('analyze').onclick=()=>{hideError();try{render(analyzeText(input.value))}catch(e){panel.classList.add('hidden');exportBtn.disabled=true;showError(e.message||String(e))}};
document.getElementById('clear').onclick=()=>{input.value='';tbody.innerHTML='';panel.classList.add('hidden');exportBtn.disabled=true;hideError()};
document.getElementById('file').onchange=e=>{const f=e.target.files&&e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{input.value=String(r.result||'')};r.readAsText(f)};
exportBtn.onclick=()=>{if(!current.length)return;const head=['Obstacle','Status','Controlling Airport','Airport Name','Distance NM','Surface','AGL ft','Top MSL ft','Penetration ft','Approach','Latitude','Longitude'];const rows=current.map(r=>[r.obstacleId,r.status,r.nearestAirport,r.airportName,r.distance,r.surfaceType,r.obstacleHeight,r.obstacleHeightMSL,r.penetrationHeight??'',r.approachType,r.latitude,r.longitude]);const csv=[head].concat(rows).map(row=>row.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(',')).join('\\r\\n');const b=new Blob([csv],{type:'text/csv'}),u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download='aviation-obstacle-analysis.csv';a.click();URL.revokeObjectURL(u)};
</script>
</body>
</html>`;

const out = path.join(root, 'AviationObstacleAnalysis-Standalone.html');
fs.writeFileSync(out, html, 'utf8');
console.log('Wrote ' + out);
console.log('Airports: ' + airports.length + ', runway ends: ' + runwayEnds.length + ', runways: ' + runways.length);
