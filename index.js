const token = require('@pg-english/token');
const number = require('@pg-english/number');
const unit = require('@pg-english/unit');
const reserved = require('@pg-english/reserved');
const entity = require('@pg-english/entity');
const T = token.type;

const NULLORDER = [
  {t: [T.KEYWORD, T.KEYWORD, T.ORDINAL], v: [/SELECT/, /NULL/, /1/], f: (s, t, i) => token(T.KEYWORD, 'NULLS FIRST')},
  {t: [T.KEYWORD, T.KEYWORD, T.TEXT], v: [/SELECT/, /NULL/, /last|first/i], f: (s, t, i) => token(T.KEYWORD, `NULLS ${t[i+2].value.toUpperCase()}`)},
];
const NUMBER = [
  {t: [T.CARDINAL, T.ORDINAL], v: [null, null], f: (s, t, i) => token(T.CARDINAL, t[i].value/t[i+1].value)},
  {t: [T.CARDINAL, T.UNIT], v: [null, null], f: (s, t, i) => token(T.CARDINAL, t[i].value*t[i+1].value)},
];
const LIMIT = [
  {t: [T.KEYWORD, T.NUMBER], v: [/ASC|LIMIT/, null], f: (s, t, i) => { s.limit = t[i+1].value; return null; }},
  {t: [T.NUMBER, T.KEYWORD], v: [null, /ASC|LIMIT/], f: (s, t, i) => { s.limit = t[i].value; return null; }},
  {t: [T.KEYWORD, T.NUMBER], v: [/(DESC )?LIMIT/, null], f: (s, t, i) => { s.limit = t[i+1].value; s.reverse = !s.reverse; return null; }},
  {t: [T.NUMBER, T.KEYWORD], v: [null, /(DESC )?LIMIT/], f: (s, t, i) => { s.limit = t[i].value; s.reverse = !s.reverse; return null; }},
];
const VALUE = [
  {t: [T.OPERATOR, T.KEYWORD, T.COLUMN], v: [/ALL/, /TYPE/, null], f: (s, t, i) => token(T.COLUMN, `all: ${t[i+2].value}`)},
  {t: [T.OPERATOR, T.KEYWORD, T.COLUMN], v: [/\+/, /TYPE/, null], f: (s, t, i) => token(T.COLUMN, `sum: ${t[i+2].value}`)},
  {t: [T.FUNCTION, T.KEYWORD, T.COLUMN], v: [/avg/, /TYPE/, null], f: (s, t, i) => token(T.COLUMN, `avg: ${t[i+2].value}`)},
  {t: [T.COLUMN, T.KEYWORD, T.CARDINAL], v: [null, /PER/, null], f: (s, t, i) => { s.columnsUsed.push(`"${t[i].value}"`); return token(T.EXPRESSION, `("${t[i].value}"*${t[i+2].value/100})`); }},
  {t: [T.COLUMN, T.KEYWORD, T.UNIT], v: [null, /PER/, null], f: (s, t, i) => { s.columnsUsed.push(`"${t[i].value}"`); return token(T.EXPRESSION, `("${t[i].value}"*${t[i+2].value/100})`); }},
  {t: [T.COLUMN, T.KEYWORD, T.UNIT], v: [null, /AS|IN/, null], f: (s, t, i) => { s.columnsUsed.push(`"${t[i].value}"`); return token(T.EXPRESSION, `("${t[i].value}"/${t[i+1].value})`); }},
  {t: [T.COLUMN], v: [null], f: (s, t, i) => { s.columnsUsed.push(`"${t[i].value}"`); return token(T.VALUE, `"${t[i].value}"`); }},
  {t: [T.NUMBER], v: [null], f: (s, t, i) => token(T.VALUE, `${t[i].value}`)},
  {t: [T.TEXT], v: [null], f: (s, t, i) => token(T.VALUE, `'${t[i].value}'`)},
  {t: [T.KEYWORD], v: [/NULL/], f: (s, t, i) => token(T.VALUE, t[i].value)},
  {t: [T.KEYWORD], v: [/TRUE|FALSE/], f: (s, t, i) => token(T.BOOLEAN, t[i].value)},
];
// T.VALUE: t[i].type
const EXPRESSION = [
  {t: [T.OPEN, T.CLOSE], v: [null, null], f: (s, t, i) => null},
  {t: [T.EXPRESSION, T.EXPRESSION, T.CLOSE], v: [null, null, null], f: (s, t, i) => [token(T.EXPRESSION, `${t[i].value}, ${t[i+1].value}`), t[i+2]]},
  {t: [T.FUNCTION], v: [/pi|random/], f: (s, t, i) => token(T.EXPRESSION, `${t[i].value}()`)},
  {t: [T.FUNCTION, T.OPEN, T.EXPRESSION, T.CLOSE], v: [null, null, null, null], f: (s, t, i) => token(T.EXPRESSION, `${t[i].value}(${t[i+2].value})`)},
  {t: [T.FUNCTION, T.EXPRESSION], v: [null, null], f: (s, t, i) => token(T.EXPRESSION, `${t[i].value}(${t[i+1].value})`)},
  {t: [T.OPEN, T.EXPRESSION, T.CLOSE], v: [null, null, null], f: (s, t, i) => token(T.EXPRESSION, `(${t[i+1].value})`)},
  {t: [T.OPERATOR, T.BINARY, T.EXPRESSION], v: [null, /\+|\-/, null], f: (s, t, i) => [t[i], token(t[i+2].type, `${t[i+1].value}${t[i+2].value}`)]},
  {t: [T.EXPRESSION, T.BINARY, T.EXPRESSION], v: [null, /\^/, null], f: (s, t, i) => token(t[i].type & t[i+2].type, `${t[i].value} ${t[i+1].value} ${t[i+2].value}`)},
  {t: [T.EXPRESSION, T.BINARY, T.EXPRESSION], v: [null, /[\*\/%]/, null], f: (s, t, i) => token(t[i].type & t[i+2].type, `${t[i].value} ${t[i+1].value} ${t[i+2].value}`)},
  {t: [T.EXPRESSION, T.BINARY, T.EXPRESSION], v: [null, /[\+\-]/, null], f: (s, t, i) => token(t[i].type & t[i+2].type, `${t[i].value} ${t[i+1].value} ${t[i+2].value}`)},
  {t: [T.UNARY, T.EXPRESSION], v: [/[^(NOT)]/, null], f: (s, t, i) => token(t[i+1].type, `${t[i].value} ${t[i+1].value}`)},
  {t: [T.EXPRESSION, T.UNARY], v: [null, /IS.*/], f: (s, t, i) => token(T.BOOLEAN, `${t[i].value} ${t[i+1].value}`)},
  {t: [T.EXPRESSION, T.BINARY, T.EXPRESSION], v: [null, /[^\w\s=!<>]+/, null], f: (s, t, i) => token(T.VALUE, `${t[i].value} ${t[i+1].value} ${t[i+2].value}`)},
  {t: [T.EXPRESSION, T.TERNARY, T.EXPRESSION, T.OPERATOR, T.EXPRESSION], v: [null, null, null, /AND/, null], f: (s, t, i) => token(T.BOOLEAN, `${t[i].value} ${t[i+1].value} ${t[i+2].value} AND ${t[i+4].value}`)},
  {t: [T.EXPRESSION, T.TERNARY, T.EXPRESSION, T.EXPRESSION], v: [null, null, null, null], f: (s, t, i) => token(T.BOOLEAN, `${t[i].value} ${t[i+1].value} ${t[i+2].value} AND ${t[i+3].value}`)},
  {t: [T.EXPRESSION, T.BINARY, T.EXPRESSION, T.OPERATOR, T.EXPRESSION], v: [null, null, null, /ESCAPE/, null], f: (s, t, i) => token(T.BOOLEAN, `${t[i].value} ${t[i+1].value} ${t[i+2].value} ESCAPE ${t[i+4].value}`)},
  // {t: [T.VALUE, T.BINARY, T.VALUE, T.OPERATOR, T.VALUE, T.OPERATOR], v: [null, null, null, /OR|AND/, null, /OR|AND/], f: (s, t, i) => [token(T.BOOLEAN, `${t[i].value} ${t[i+1].value} ${t[i+2].value} AND ${t[i].value} ${t[i+1].value} ${t[i+4].value}`), t[i+5]]},
  // {t: [T.VALUE, T.OPERATOR, T.VALUE, T.BINARY, T.VALUE, T.OPERATOR], v: [null, /OR|AND/, null, null, null, /OR|AND/], f: (s, t, i) => [token(T.BOOLEAN, `${t[i].value} ${t[i+3].value} ${t[i+4].value} AND ${t[i+2].value} ${t[i+3].value} ${t[i+4].value}`), t[i+5]]},
  {t: [T.KEYWORD, T.VALUE, T.BINARY, T.VALUE, T.OPERATOR, T.VALUE], v: [null, null, /[^(OR)|(AND)]/, null, /OR|AND/, null], f: (s, t, i) => i+6>=t.length? [t[i], token(T.BOOLEAN, `${t[i+1].value} ${t[i+2].value} ${t[i+3].value} AND ${t[i+1].value} ${t[i+2].value} ${t[i+5].value}`)]:t.slice(i, i+6)},
  {t: [T.KEYWORD, T.VALUE, T.OPERATOR, T.VALUE, T.BINARY, T.VALUE], v: [null, null, /OR|AND/, null, /[^(OR)|(AND)]/, null], f: (s, t, i) => i+6>=t.length? [t[i], token(T.BOOLEAN, `${t[i+1].value} ${t[i+4].value} ${t[i+5].value} AND ${t[i+3].value} ${t[i+4].value} ${t[i+4].value}`)]:t.slice(i, i+6)},
  {t: [T.EXPRESSION, T.BINARY, T.EXPRESSION], v: [null, /[^(OR)(AND)]/, null], f: (s, t, i) => token(T.BOOLEAN, `${t[i].value} ${t[i+1].value} ${t[i+2].value}`)},
  {t: [T.UNARY, T.EXPRESSION], v: [null, null], f: (s, t, i) => token(T.BOOLEAN, `${t[i].value} ${t[i+1].value}`)},
  {t: [T.VALUE, T.BINARY, T.VALUE], v: [null, /AND/, null], f: (s, t, i) => { s.columnsUsed.push(t[i].value, t[i+2].value); return [t[i], t[i+2]]; }},
  {t: [T.BINARY, T.VALUE], v: [/AND/, null], f: (s, t, i) => { s.columnsUsed.push(t[i+1].value); return t[i+1]; }},
  {t: [T.EXPRESSION, T.BINARY, T.EXPRESSION], v: [null, null, null], f: (s, t, i) => token(T.BOOLEAN, `${t[i].value} ${t[i+1].value} ${t[i+2].value}`)},
];
const ORDERBY = [
  {t: [T.EXPRESSION, T.KEYWORD, T.KEYWORD], v: [null, /DESC/, /NULLS (FIRST|LAST)/], f: (s, t, i) => { s.orderBy.push(`${t[i].value} ${s.reverse? 'ASC':'DESC'} ${t[i+2].value}`); return null; }},
  {t: [T.EXPRESSION, T.KEYWORD, T.KEYWORD], v: [null, /ASC/, /NULLS (FIRST|LAST)/], f: (s, t, i) => { s.orderBy.push(`${t[i].value} ${s.reverse? 'DESC':'ASC'} ${t[i+2].value}`); return null; }},
  {t: [T.KEYWORD, T.EXPRESSION, T.KEYWORD], v: [/DESC/, null, /NULLS (FIRST|LAST)/], f: (s, t, i) => { s.orderBy.push(`${t[i+1].value} ${s.reverse? 'ASC':'DESC'} ${t[i+2].value}`); return null; }},
  {t: [T.KEYWORD, T.EXPRESSION, T.KEYWORD], v: [/ASC/, null, /NULLS (FIRST|LAST)/], f: (s, t, i) => { s.orderBy.push(`${t[i+1].value} ${s.reverse? 'DESC':'ASC'} ${t[i+2].value}`); return null; }},
  {t: [T.OPERATOR, T.OPERATOR, T.EXPRESSION], v: [/>|>=/, /IN/, null], f: (s, t, i) => { s.orderBy.push(`${t[i+1].value} ${s.reverse? 'ASC':'DESC'}`); return null; }},
  {t: [T.OPERATOR, T.OPERATOR, T.EXPRESSION], v: [/<|<=/, /IN/, null], f: (s, t, i) => { s.orderBy.push(`${t[i+1].value} ${s.reverse? 'DESC':'ASC'}`); return null; }},
  {t: [T.EXPRESSION, T.KEYWORD], v: [null, /NULLS (FIRST|LAST)/], f: (s, t, i) => { s.orderBy.push(`${t[i].value} ${s.reverse? 'DESC':'ASC'} ${t[i+1].value}`); return null; }},
  {t: [T.KEYWORD, T.EXPRESSION], v: [/NULLS (FIRST|LAST)/, null], f: (s, t, i) => { s.orderBy.push(`${t[i+1].value} ${s.reverse? 'DESC':'ASC'} ${t[i].value}`); return null; }},
  {t: [T.EXPRESSION, T.KEYWORD], v: [null, /DESC/], f: (s, t, i) => { s.orderBy.push(`${t[i].value} ${s.reverse? 'ASC':'DESC'}`); return null; }},
  {t: [T.KEYWORD, T.EXPRESSION], v: [/DESC/, null], f: (s, t, i) => { s.orderBy.push(`${t[i+1].value} ${s.reverse? 'ASC':'DESC'}`); return null; }},
  {t: [T.EXPRESSION, T.KEYWORD], v: [null, /ASC/], f: (s, t, i) => { s.orderBy.push(`${t[i].value} ${s.reverse? 'DESC':'ASC'}`); return null; }},
  {t: [T.KEYWORD, T.EXPRESSION], v: [/ASC/, null], f: (s, t, i) => { s.orderBy.push(`${t[i+1].value} ${s.reverse? 'DESC':'ASC'}`); return null; }},
  {t: [T.OPERATOR, T.EXPRESSION], v: [/>|>=/, null], f: (s, t, i) => { s.orderBy.push(`${t[i+1].value} ${s.reverse? 'ASC':'DESC'}`); return null; }},
  {t: [T.OPERATOR, T.EXPRESSION], v: [/<|<=/, null], f: (s, t, i) => { s.orderBy.push(`${t[i+1].value} ${s.reverse? 'DESC':'ASC'}`); return null; }},
  {t: [T.EXPRESSION, T.OPERATOR], v: [null, />|>=/], f: (s, t, i) => { s.orderBy.push(`${t[i].value} ${s.reverse? 'ASC':'DESC'}`); return null; }},
  {t: [T.EXPRESSION, T.OPERATOR], v: [null, /<|<=/], f: (s, t, i) => { s.orderBy.push(`${t[i].value} ${s.reverse? 'DESC':'ASC'}`); return null; }},
  {t: [T.KEYWORD, T.EXPRESSION], v: [/ORDER BY/, null], f: (s, t, i) => { s.orderBy.push(`${t[i+1].value} ${s.reverse? 'DESC':'ASC'}`); return t[i]; }},
];
const GROUPBY = [
  {t: [T.KEYWORD, T.EXPRESSION], v: [/GROUP BY/, null], f: (s, t, i) => { s.groupBy.push(`${t[i+1].value}`); return t[i]; }},
];
const HAVING = [
  {t: [T.OPERATOR, T.OPERATOR, T.KEYWORD, T.EXPRESSION], v: [/OR|AND/, /NOT/, /HAVING/, null], f: (s, t, i) => { s.having += `${t[i].value} (NOT ${t[i+3].value})`; return null; }},
  {t: [T.OPERATOR, T.KEYWORD, T.EXPRESSION], v: [/NOT/, /HAVING/, null], f: (s, t, i) => { s.having += `AND (NOT ${t[i+2].value})`; return null; }},
  {t: [T.OPERATOR, T.KEYWORD, T.EXPRESSION], v: [/OR|AND/, /HAVING/, null], f: (s, t, i) => { s.having += `${t[i].value} (${t[i+2].value})`; return null; }},
  {t: [T.KEYWORD, T.EXPRESSION], v: [/HAVING/, null], f: (s, t, i) => { s.having += `AND (${t[i+1].value})`; return null; }},
];
const WHERE = [
  {t: [T.OPERATOR, T.OPERATOR, T.KEYWORD, T.EXPRESSION], v: [/OR|AND/, /NOT/, /WHERE/, null], f: (s, t, i) => { s.where += `${t[i].value} (NOT ${t[i+3].value})`; return null; }},
  {t: [T.OPERATOR, T.KEYWORD, T.EXPRESSION], v: [/NOT/, /WHERE/, null], f: (s, t, i) => { s.where += `AND (NOT ${t[i+2].value})`; return null; }},
  {t: [T.OPERATOR, T.KEYWORD, T.EXPRESSION], v: [/OR|AND/, /WHERE/, null], f: (s, t, i) => { s.where += `${t[i].value} (${t[i+2].value})`; return null; }},
  {t: [T.KEYWORD, T.EXPRESSION], v: [/WHERE/, null], f: (s, t, i) => { s.where += `AND (${t[i+1].value})`; return null; }},
];
const FROM = [
  {t: [T.OPERATOR, T.ENTITY, T.OPERATOR], v: [/ALL/, /(field|column)s?/i, null], f: (s, t, i) => { s.columns.push('*'); return null; }},
  {t: [T.KEYWORD], v: [/GROUP BY/], f: (s, t, i) => { if(i!==t.length-1 || s.groupBy.length!==0) return t[i]; s.from.push('"groups"'); return null; }},
  {t: [T.TABLE], v: [null], f: (s, t, i) => { s.from.push(`"${t[i].value}"`); return null; }},
  {t: [T.ROW], v: [null], f: (s, t, i) => { s.from.push(`"${t[i].value}"`); return null; }},
];
const COLUMN = [
  {t: [T.KEYWORD, T.KEYWORD, T.EXPRESSION, T.KEYWORD, T.EXPRESSION], v: [/SELECT/, /ALL|DISTINCT/, null, /AS/, null], f: (s, t, i) => { s.columns.push(`${t[i+1].value} ${t[i+2].value} AS ${t[i+4].value}`); return t[i]; }},
  {t: [T.KEYWORD, T.KEYWORD, T.EXPRESSION], v: [/SELECT/, /ALL|DISTINCT/, null], f: (s, t, i) => { s.columns.push(`${t[i+1].value} ${t[i+2].value}`); return t[i]; }},
  {t: [T.KEYWORD, T.EXPRESSION, T.KEYWORD, T.EXPRESSION], v: [/SELECT/, null, /AS/, null], f: (s, t, i) => { s.columns.push(`${t[i+1].value} AS ${t[i+3].value}`); return t[i]; }},
  {t: [T.KEYWORD, T.EXPRESSION], v: [/SELECT/, null], f: (s, t, i) => { s.columns.push(t[i+1].value); return t[i]; }},
  {t: [T.OPERATOR, T.OPERATOR], v: [/ALL/, null], f: (s, t, i) => { s.columns.push('*'); return null; }},
  {t: [T.OPERATOR], v: [/ALL/], f: (s, t, i) => { if(i!==t.length-1) return t[i]; s.columns.push('*'); return null; }},
];

function typeMatch(tkns, i, typ) {
  if(i+typ.length>tkns.length) return false;
  for(var j=0, J=typ.length; j<J; i++, j++)
    if((tkns[i].type & 0xF0)!==(typ[j] & 0xF0) || ((typ[j] & 0xF)>0 && tkns[i].type!==typ[j])) return false;
  return true;
};

function valueMatch(tkns, i, val) {
  for(var j=0, J=val.length; j<J; i++, j++)
    if(val[j]!=null && !val[j].test(tkns[i].value)) return false;
  return true;
};

function substageRun(sub, sta, tkns, rpt=false) {
  var z = tkns;
  do {
    var tkns = z, z = [];
    for(var i=0, I=tkns.length; i<I; i++) {
      if(!typeMatch(tkns, i, sub.t) || !valueMatch(tkns, i, sub.v)) { z.push(tkns[i]); continue; }
      var ans = sub.f(sta, tkns, i), i = i+sub.t.length-1;
      if(ans==null) continue;
      else if(!Array.isArray(ans)) z.push(ans);
      z.push.apply(z, ans);
    }
  } while (rpt && z.length<tkns.length);
  return z;
};

function stageRun(stg, sta, tkns, rpt0=false, rpt1=false) {
  var z = tkns;
  do {
    var plen = tkns.length;
    for(var sub of stg)
      z = substageRun(sub, sta, tkns=z, rpt0);
  } while(rpt1 && z.length<plen);
  return z;
};

function process(tkns) {
  var sta = {columns: [], from: [], groupBy: [], orderBy: [], where: '', having: '', limit: 0, columnsUsed: [], reverse: false};
  tkns = tkns.filter((t) => t.type!==T.SEPARATOR);
  if(tkns[0].value!=='SELECT') tkns.unshift(token(T.KEYWORD, 'SELECT'));
  tkns = stageRun(NULLORDER, sta, tkns);
  tkns = stageRun(NUMBER, sta, tkns);
  tkns = stageRun(LIMIT, sta, tkns);
  tkns = stageRun(VALUE, sta, tkns);
  tkns = stageRun(EXPRESSION, sta, tkns, true, true);
  tkns = stageRun(ORDERBY, sta, tkns, false, true);
  tkns = stageRun(GROUPBY, sta, tkns, true);
  tkns = stageRun(HAVING, sta, tkns);
  tkns = stageRun(WHERE, sta, tkns);
  tkns = stageRun(FROM, sta, tkns);
  tkns = stageRun(COLUMN, sta, tkns);
  if(sta.having.startsWith('AND ')) sta.having = sta.having.substring(4);
  if(sta.where.startsWith('AND ')) sta.where = sta.where.substring(4);
  var i = sta.columns.indexOf(`"*"`);
  if(i>=0) sta.columns[i] = `*`;
  if(sta.columns.length===0 || !sta.columns.includes('*')) {
    for(var ord of sta.orderBy) {
      var exp = ord.replace(/ (ASC|DESC)$/, '');
      if(!sta.columns.includes(exp)) sta.columns.push(exp);
    }
  }
  if(sta.groupBy.length===0 && (sta.columns.length===0 || !sta.columns.includes('*'))) {
    for(var col of sta.columnsUsed)
      if(!sta.columns.includes(col)) sta.columns.push(col);
  }
  for(var i=sta.groupBy.length-1; i>=0; i--)
    sta.columns.unshift(sta.groupBy[i]);
  if(sta.from.length===0) sta.from.push(`"food"`);
  if(data.table(sta.from[0].replace(/\"/g, ''))!=='compositions_tsvector') { if(sta.columns.length===0) sta.columns.push('*'); }
  else if(!sta.columns.includes('*') && !sta.columns.includes(`"name"`)) sta.columns.unshift(`"name"`);
  var z = `SELECT ${sta.columns.join(', ')} FROM ${sta.from.join(', ')}`;
  if(sta.where.length>0) z += ` WHERE ${sta.where}`;
  if(sta.groupBy.length>0) z += ` GROUP BY ${sta.groupBy.join(', ')}`;
  if(sta.orderBy.length>0) z += ` ORDER BY ${sta.orderBy.join(', ')}`;
  if(sta.having.length>0) z += ` HAVING ${sta.having}`;
  if(sta.limit>0) z += ` LIMIT ${sta.limit}`;
  return z;
};

function tokenize(txt) {
  var quo = null, y = '', z = [];
  for(var c of txt) {
    if((quo!=null && quo!=c) || /\w/.test(c)) { y += c; continue; }
    if(y) { z.push(token(quo!=null? T.QUOTED:T.TEXT, y)); y = ''; }
    if(/[\'\"\`]/.test(c)) quo = quo==null? c:null;
    else if(/\S/g.test(c)) z.push(token(T.TEXT, c));
  }
  if(y) z.push(token(quo!=null? T.QUOTED:T.TEXT, y));
  return z;
};

async function nlp(db, txt) {
  var tkns = tokenize(txt);
  tkns = number(tkns);
  tkns = unit(tkns);
  tkns = reserved(tkns);
  tkns = await entity(db, tkns);
  tkns = tkns.filter((v) => v.type!==T.TEXT || !/[~!@#$:,\?\.\|\/\\]/.test(v.value));
  if(tkns.length>0 && (tkns[0].type & 0xF0)!==T.KEYWORD) tkns.unshift(token(T.KEYWORD, 'SELECT'));
  return process(tkns);
};
module.exports = nlp;
