from pathlib import Path
import re,csv,json,shutil
v=Path('/Users/alexander/Obsidian/2ndBrain');stage=Path('/private/tmp/pf-dashboard-stage');stage.mkdir(exist_ok=True)
rows=list(csv.DictReader((v/'02 Projekte/picturefish-obsidian-navigator/Notes/2026-10-04 Dashboard-Zuordnung.csv').open()))
assert len(rows)==34
leads=['Dashboard/Projektatlas/00-Projektatlas.md','Dashboard/19-Task-Overview.md','Dashboard/Bücher Übersicht.md','Dashboard/13-LinkedIn-CMS.md','Dashboard/10-Salerno-Overview.md','Dashboard/Lose Enden.md']
sources={'tasks':['TaskForge','TaskNotes','05 Daily Notes','02 Projekte'], 'books':['04 Ressourcen/Bücher'], 'activity':['01 Inbox','02 Projekte','03 Bereiche','04 Ressourcen','05 Daily Notes','99 published','99 linkedIn','Clippings','TaskForge','TaskNotes','RIS'], 'clips':['Clippings','01 Inbox','04 Ressourcen','02 Projekte','99 published']}
config={'version':1,'favorites':['Dashboard/Lose Enden.md',leads[0],leads[1],leads[2]],'visible':['projects','tasks','sources','publish','personal','care'],'sources':sources,'entries':[]}
for r in rows:
 e={'path':r['path'],'label':r['label'],'area':r['area'],'source':r['source'],'legacy':r['legacy']=='True','lead':r['path'] in leads}
 if r['kind']=='snapshot':e['stand']='Snapshot: 20.08.2026'
 elif r['kind']=='import':e['stand']='Importierter Stand; Datum in der Fachansicht prüfen'
 if e['area']=='tasks':e['source']='Gemeinsame Aufgabenquellen: TaskForge, TaskNotes, Daily Notes und Projekte'
 elif r['kind']=='pruefen':e['source']='Begrenzte konfigurierte Quellen: '+('Web-Clips' if 'Web-Clips' in e['path'] else 'Vault-Aktivität')
 config['entries'].append(e)
# JSON flow values are valid YAML; serialized quoted Unicode values preserve links and arrays.
hub='''---\ntype: dashboard\ncssclasses: [pf-home-note, wide-page]\nstatus: aktiv\ndate: 2026-10-05\nupdated: 2026-10-05\nvalid_from: 2026-10-05\nreviewed: 2026-10-05\nsuperseded_by: null\ncoauthored_by: "Codex GPT-6"\nevidence: ["Alexander, 2026-10-05: Dashboard-Mockup freigegeben", "[[UC-0135 – Dashboards über einen gemeinsamen Einstieg erreichen]]"]\npf_dashboards: '''+json.dumps(config,ensure_ascii=False)+'\n---\n\n```pf-dashboards\n```\n\n> [!info]- Einstiegslinks ohne dynamische Ansicht\n> [[Dashboard/Startseite|Startseite]] · [[Dashboard/Lose Enden|Pflegeübersicht]]\n>\n'
for g in ['projects','tasks','sources','publish','personal','care']:
 for e in config['entries']:
  if e['area']==g:hub+=f"> - [[{e['path'][:-3]}|{e['label']}]]\n"
hub+='\n'
def put(path,s):
 p=stage/path;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(s)
put('Dashboard/Dashboards.md',hub)
api="const pf = app.plugins.plugins['picturefish-obsidian-navigator']?.dashboard;\nif (!pf) throw new Error('Picturefish Navigator aktivieren, um die begrenzten Quellen auszuwerten.');\n"
for r in rows:
 path=r['path'];p=v/path;assert not p.is_symlink();s=p.read_text()
 group='atlas' if path.startswith('Dashboard/Projektatlas/') else 'books' if '/Bücher ' in path else 'tasks' if r['area']=='tasks' else 'activity' if r['area']=='care' and path!='Dashboard/Lose Enden.md' else r['area']
 # A single shared perspective toolbar is placed before the existing content.
 end=s.index('\n---',4)+4 if s.startswith('---\n') else 0
 s=s[:end]+'\n\n```pf-perspectives\n'+group+'\n```\n'+s[end:]
 if r['kind']=='pruefen' and path!='Dashboard/12-TaskForge-Dashboard.md':
  s=s.replace("dv.pages('\"\"')", "(await pf.pages('activity', dv))").replace('dv.pages()', "(await pf.pages('activity', dv))")
  s=s.replace('app.vault.getMarkdownFiles()', "await pf.files('activity')")
  if 'Web-Clips' in path:
   s=s.replace("dv.pages('#web-clip').array()", "(await pf.pages('clips', dv)).where(p => [...(p.tags || []), ...(p.file.tags || [])].some(t => String(t).replace(/^#/, '') === 'web-clip')).array()")
   s=s.replace('function loadClips()', 'async function loadClips()').replace('const allClips = loadClips();', 'const allClips = await loadClips();')
   s=s.replace('Alle Notizen im Vault mit', 'Notizen in den konfigurierten Quellen mit')
  s=s.replace('```dataviewjs\n','```dataviewjs\n'+api)
 if '/Bücher ' in path:
  s=s.replace('```dataviewjs\n','```dataviewjs\n'+api)
  s=s.replace('dv.pages(`"${BOOKS_FOLDER}"`)', "(await pf.pages('books', dv))").replace('dv.pages(`"${FOLDER}"`)', "(await pf.pages('books', dv))")
  if 'const classify = ' in s:
   a=s.index('const classify = ');b=s.index('\nconst books = ',a);s=s[:a]+'const classify = page => pf.classifyBook(page);\n'+s[b:]
  else:
   a=s.index('const fileExists = ');b=s.index('const toArray = ',a)
   s=s[:a]+"const covers = await pf.coverMap(pages);\nconst coverFileFor = book => covers[book.file.path];\n\n"+s[b:]
   s=s.replace('book.gelesen ? "gelesen" : "ungelesen"','pf.bookRead(book) ? "gelesen" : "ungelesen"').replace('Boolean(book.gelesen)','pf.bookRead(book)')
   s=s.replace('const themes = toArray(book.themen).map(asText).filter(Boolean);','const classification = pf.classifyBook(book);\n  const themes = [...new Set([...toArray(book.themen).map(asText).filter(Boolean), classification.area, classification.topic])];')
  s=s.replace('```dataview\nTABLE cover as "Cover", autor as "Autor", verlag as "Verlag", erschienen as "Jahr", seiten as "Seiten", themen as "Themen", choice(gelesen, "gelesen", "ungelesen") as "Status"\nFROM "04 Ressourcen/Bücher"\nWHERE type = "buch"\nSORT titel ASC\n```',"```dataviewjs\nconst pf = app.plugins.plugins['picturefish-obsidian-navigator']?.dashboard;\nif (!pf) throw new Error('Picturefish Navigator aktivieren, um die begrenzten Quellen auszuwerten.');\nconst rows = (await pf.pages('books', dv)).where(p => p.type === 'buch').array().sort((a,b)=>String(a.titel || a.file.name).localeCompare(String(b.titel || b.file.name)));\nconst covers = await pf.coverMap(rows);\ndv.table(['Buch', 'Cover', 'Autor', 'Verlag', 'Jahr', 'Seiten', 'Themen', 'Status'], rows.map(p => {\n  const c = pf.classifyBook(p), cover = covers[p.file.path];\n  return [dv.fileLink(p.file.path), cover ? dv.fileLink(cover.path, true) : '—', p.autor || '—', p.verlag || '—', p.erschienen || '—', p.seiten || '—', [...new Set([...(Array.isArray(p.themen) ? p.themen : p.themen ? [p.themen] : []).map(String), c.area, c.topic])].join(' · '), pf.bookRead(p) ? 'gelesen' : 'ungelesen'];\n}));\n```")
  s=s.replace('app.workspace.openLinkText(path, "", event.metaKey || event.ctrlKey)', 'pf.service.open(path, event.metaKey || event.ctrlKey)').replace('app.workspace.openLinkText(el.getAttribute("data-path"), "", event.metaKey || event.ctrlKey)', 'pf.service.open(el.getAttribute("data-path"), event.metaKey || event.ctrlKey)')
 if path=='Dashboard/17-Task-Board.md':
  s=s.replace('```dataviewjs\n','```dataviewjs\n'+api)
  a=s.index('const pages = ');b=s.index('const esc = ',a);s=s[:a]+s[b:]
  a=s.index('const stateOf = ');b=s.index('const projects = ',a)
  s=s[:a]+"const stateOf = (status, completed, workState) => pf.taskState(status, completed, workState);\nconst unique = await pf.tasks(dv);\n"+s[b:]
  s=s.replace("new Date().toISOString().slice(0,10)","new Date().toLocaleDateString('sv-SE')")
  s=s.replace('data-path="${esc(item.path)}"', 'data-path="${esc(item.path)}" data-line="${item.line ?? \'\'}"')
  s=s.replace("app.workspace.openLinkText(el.dataset.path,'',e.metaKey||e.ctrlKey)","pf.service.open(el.dataset.path,e.metaKey||e.ctrlKey,el.dataset.line === '' ? undefined : Number(el.dataset.line))")
  s=s.replace('Quelle: `TaskForge/` und `TaskNotes/`.', 'Quelle: gemeinsame Aufgabenquellen, konfigurierbar in [[Dashboard/Dashboards]].')
 if path=='Dashboard/19-Task-Overview.md':
  a=s.index('const pages=');b=s.index('const includeParked=',a)
  s=s[:a]+api+'''const esc=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const unique=await pf.tasks(dv); const today=new Date().toLocaleDateString('sv-SE');
'''+s[b:]
  s=s.replace("r.due===today", "r.due===today || r.scheduled===today")
  s=s.replace('data-path="${esc(r.path)}"', 'data-path="${esc(r.path)}" data-line="${r.line ?? \'\'}"')
  s=s.replace("app.workspace.openLinkText(el.dataset.path,'',e.metaKey||e.ctrlKey)","pf.service.open(el.dataset.path,e.metaKey||e.ctrlKey,el.dataset.line === '' ? undefined : Number(el.dataset.line))")
 if path=='Dashboard/12-TaskForge-Dashboard.md':
  a=s.index('```dataviewjs\n');b=s.index('\n```',a)
  s=s[:a]+'''```dataviewjs
'''+api+'''const records = await pf.tasks(dv);
dv.table(['Gesamt', 'Erledigt', 'Geparkt', 'Heute', 'Überfällig', 'Diese Woche'], [[records.length, records.filter(r=>r.done).length, records.filter(r=>r.parked&&!r.done).length, pf.taskList(records,'today').length, pf.taskList(records,'overdue').length, pf.taskList(records,'week').length]]);
'''+s[b:]
  modes=iter(['focus','today','overdue','week','projects','done','recurring'])
  s=re.sub(r'```tasks\n[\s\S]*?\n```',lambda m:'```dataviewjs\n'+api+f"await pf.renderTasks(dv, '{next(modes)}');\n```",s)
  s=s.replace('Alle Tasks leben als Markdown-Checkboxes in den Projekten unter `TaskForge/Projekte/` und `TaskForge/Inbox/`.', 'Diese Ansicht nutzt dieselben konfigurierten Aufgabenquellen wie Übersicht, Board und Startseite.')
 if path=='Dashboard/22-Wissensfrische.md':
  a=s.index('```dataview\n');b=s.index('\n```',a)+4;s=s[:a]+'```pf-freshness\n```'+s[b:]
  s=s.replace('ohne Prüfung seit 90 Tagen','mit fehlendem oder fälligem Prüfstand')
 if r['legacy']=='True':
  s+='\n\n## Gemeinsamer Einstieg\n\n[[Dashboard/Startseite|Startseite]] · [[Dashboard/Dashboards|Dashboard-Übersicht]]. Diese Spezialperspektive bleibt für bestehende Links erhalten. Ihr Quellumfang ist jetzt ausdrücklich in der Dashboard-Übersicht konfiguriert.\n'
 s=s.replace('updated: 2026-08-07','updated: 2026-10-05').replace('updated: 2026-09-24','updated: 2026-10-05')
 put(path,s)
# Keep the separate historic landing page usable, with the same source boundary.
p=v/'Swimlane-Übersicht.md';s=p.read_text().replace("dv.pages('\"\"')", "(await pf.pages('activity', dv))").replace('```dataviewjs\n','```dataviewjs\n'+api)
s+='\n\n[[Dashboard/Startseite|Gemeinsame Startseite]] · [[Dashboard/Dashboards|Dashboard-Übersicht]].\n';put('Swimlane-Übersicht.md',s)
modes={'Heute':'today','Diese-Woche':'week','Ueberfaellig':'overdue','Fokus':'focus','Prio-Hoch':'high','Ohne-Datum':'undated'}
for name in modes:
 p=v/'TaskForge/SmartLists'/(name+'.md')
 assert p.is_file() and not p.is_symlink()
 s=p.read_text();mode=modes.get(p.stem)
 if mode:s=re.sub(r'```tasks\n[\s\S]*?\n```',lambda m:'```dataviewjs\n'+api+f"await pf.renderTasks(dv, '{mode}');\n```",s)
 put(str(p.relative_to(v)),s)
# Home module activation preserves existing configuration and text. Remove redundant task-folder configuration only.
s=(v/'Dashboard/Startseite.md').read_text()
s=s.replace('  modules:\n','  modules:\n    - id: dashboards\n      enabled: true\n      folders: []\n',1)
s=s.replace('[[Dashboard/00-Vault-Cockpit|Vault-Cockpit]]','[[Dashboard/Dashboards|Alle Dashboards]]')
s=re.sub(r'(    - id: tasks\n      enabled: true\n      folders:)\n(?:        - [^\n]+\n)+', r'\1 []\n', s)
s=s.replace('erledige sie in ihrer Quellnotiz.', 'erledige sie in ihrer Quellnotiz. Ihre gemeinsamen Quellen stehen in [[Dashboard/Dashboards]].')
put('Dashboard/Startseite.md',s)
# Install plan targets only these exact known regular files. No root traversal.
paths=[str(p.relative_to(stage)) for p in stage.rglob('*') if p.is_file()]
Path('/private/tmp/pf-dashboard-stage-files.json').write_text(json.dumps(paths,ensure_ascii=False,indent=2))
print(f'{len(paths)} Dashboard-/Einstiegsdateien vorbereitet. Produktive Dateien noch unverändert.')
