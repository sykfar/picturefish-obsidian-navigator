import type { Page } from './model';
const scalar = (v: unknown): string => (typeof v === 'string' || typeof v === 'number' ? String(v) : '');
const text = (v: unknown): string => {
    if (v === null || v === undefined) return '';
    if (Array.isArray(v)) return (v as unknown[]).map(text).filter(Boolean).join(', ');
    if (typeof v === 'object' && 'path' in v) {
        return ('display' in v && scalar(v.display)) || scalar(v.path).split('/').pop()?.replace(/\.md$/, '') || '';
    }
    return scalar(v);
};
const values = (v: unknown): unknown[] => (v === null || v === undefined ? [] : Array.isArray(v) ? v : [v]);
const norm = (v: unknown): string => text(v).toLocaleLowerCase('de');
export function bookRead(page: Record<string, unknown>): boolean {
    if (typeof page.gelesen === 'boolean') return page.gelesen;
    if (typeof page.gelesen === 'string') {
        const v = page.gelesen.trim().toLowerCase();
        if (['false', 'nein', 'ungelesen', '0'].includes(v)) return false;
        if (['true', 'ja', 'gelesen', '1'].includes(v)) return true;
    }
    return ['gelesen', 'abgeschlossen', 'done', 'read'].includes(text(page.lesestatus ?? page.status).toLowerCase());
}
export function classifyBook(page: Page) {
    const title = text(page.titel) || page.file.name;
    const tags = values(page.themen)
        .concat(values(page.tags))
        .map(norm)
        .filter(tag => tag && tag !== 'buch');
    const has = (...needles: string[]) => needles.some(needle => tags.some(tag => tag.includes(needle)));
    const named = norm(title);
    const explicitArea = text(page.bereich).trim();
    const explicitTopic = text(page.unterthema).trim();
    let area;

    if (has('finanz', 'deutsche-bank', 'geldwäsche', 'korruption', 'subprime', 'spekulation', 'marktversagen')) {
        area = 'Wirtschaft & Politik';
    } else if (
        has(
            'theologie',
            'christentum',
            'geografie',
            'reisen',
            'pilgern',
            'sport',
            'alpen',
            'wander',
            'bayerisch',
            'heimat',
            'rosenheim',
            'landschaft'
        )
    ) {
        area = 'Reisen & Spiritualität';
    } else if (has('beziehung', 'partnerschaft', 'liebe', 'emotionale-verbindung', 'beziehungskommunikation')) {
        area = 'Psychologie & Beziehungen';
    } else if (has('pilates', 'körpertraining', 'funktionales-training', 'anatomie', 'fitness', 'bewegung')) area = 'Gesundheit & Bewegung';
    else if (has('antike', 'geschichte', 'biografie', 'historisch')) area = 'Geschichte & Biografie';
    else if (has('trendwörter', 'zeitgeist', 'pop-kultur', 'lexikon', 'sprachkultur')) area = 'Kultur & Sprache';
    else if (
        has(
            'gesund',
            'ernährung',
            'blutzucker',
            'stoffwechsel',
            'regionalgeschichte',
            'alpenkultur',
            'englisch',
            'vokabular',
            'sprachreferenz'
        )
    ) {
        area = 'Leben & Kultur';
    } else if (has('funktionale-programmierung', 'scala', 'software', 'programmier', 'development', 'type-safety', 'devops')) {
        area = 'Softwareentwicklung & Architektur';
    } else if (named.includes('how google works') || named.includes('google way')) area = 'Strategie & Wachstum';
    else if (
        has(
            'strategie',
            'wachstum',
            'skalierung',
            'marketing',
            'brand',
            'e-commerce',
            'geschäftsmodell',
            'unternehmertum',
            'wettbewerb',
            'marktinnovation',
            'kundenservice',
            'service-design',
            'kundenzufriedenheit',
            'geschäftseffizienz'
        )
    ) {
        area = 'Strategie & Wachstum';
    } else if (
        has('ki', 'chatgpt', 'digital', 'technologie', 'devops', 'internet-revolution', 'automatisierung', 'datenkolon', 'tech-konzerne')
    ) {
        area = 'Technologie & Gesellschaft';
    } else if (
        has(
            'persön',
            'psychologie',
            'denken',
            'kognitiv',
            'fokus',
            'konzentration',
            'resilienz',
            'survival',
            'notfall',
            'produktiv',
            'leistung',
            'grenzen',
            'kreativ'
        )
    ) {
        area = 'Denken & Selbstführung';
    } else if (
        has(
            'führung',
            'leadership',
            'unternehmens',
            'organisation',
            'team',
            'management',
            'okr',
            'zielmanagement',
            'change',
            'verantwortung'
        )
    ) {
        area = 'Organisation & Führung';
    } else area = 'Weitere Themen';
    if (explicitArea) area = explicitArea;

    let topic;
    if (area === 'Organisation & Führung') {
        topic = has('okr', 'zielmanagement', 'leistungsmess', 'performance')
            ? 'OKR & Steuerung'
            : has('führung', 'leadership', 'unternehmenskultur', 'team', 'motivation', 'konflikt', 'change', 'verantwortung')
              ? 'Führung & Kultur'
              : 'Organisation & Zusammenarbeit';
    } else if (area === 'Strategie & Wachstum') {
        topic = has('kundenservice', 'service-design', 'kundenzufriedenheit', 'geschäftseffizienz')
            ? 'Service Design & Kundenerlebnis'
            : has('marketing', 'brand', 'storytelling', 'kunden', 'messaging', 'kommunikation')
              ? 'Marke & Kommunikation'
              : 'Strategie & Märkte';
    } else if (area === 'Denken & Selbstführung') {
        topic = has('resilienz', 'survival', 'notfall', 'grenzen', 'mentale-stärke')
            ? 'Resilienz & Grenzen'
            : has('fokus', 'produktiv', 'effizienz', 'leistung', 'zeitmanagement', 'prioritäten')
              ? 'Fokus & Leistung'
              : 'Denken & Psychologie';
    } else if (area === 'Technologie & Gesellschaft') {
        topic = has('regulierung', 'technologische-macht', 'gesellschaftliche-risiken', 'zukunftstrends', 'zukunftsszenarios')
            ? 'KI, Macht & Regulierung'
            : has('ki', 'chatgpt', 'automatisierung', 'arbeitswelt', 'digital-transformation', 'bildung')
              ? 'KI & Arbeitswelt'
              : 'Macht & Gesellschaft';
    } else if (area === 'Wirtschaft & Politik') topic = 'Finanzsystem';
    else if (area === 'Reisen & Spiritualität') {
        topic = has('theologie', 'christentum', 'pilgern') ? 'Pilgern & Spiritualität' : 'Reisen & Natur';
    } else if (area === 'Psychologie & Beziehungen') topic = 'Partnerschaft & Kommunikation';
    else if (area === 'Gesundheit & Bewegung') topic = 'Training & Körperbewusstsein';
    else if (area === 'Geschichte & Biografie') topic = 'Antike & Persönlichkeiten';
    else if (area === 'Kultur & Sprache') topic = 'Zeitgeist & Sprachkultur';
    else if (area === 'Leben & Kultur') {
        topic = has('gesund', 'ernährung', 'blutzucker', 'stoffwechsel') ? 'Gesundheit' : 'Kultur & Sprache';
    } else if (area === 'Softwareentwicklung & Architektur') {
        topic = has('funktionale-programmierung', 'scala')
            ? 'Funktionale Programmierung'
            : has('devops')
              ? 'DevOps & Betrieb'
              : 'Softwarearchitektur';
    } else topic = 'Neu erkannte Themen';
    if (explicitTopic) topic = explicitTopic;

    return { title, author: text(page.autor).replace(/\[|\]/g, ''), area, topic, read: bookRead(page), path: page.file.path };
}
