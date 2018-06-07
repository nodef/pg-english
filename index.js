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

function stageRunAll(tkns, opt={}) {
  var s = {columns: [], from: [], groupBy: [], orderBy: [], where: '', having: '', limit: 0, columnsUsed: [], reverse: false};
  tkns = tkns.filter((t) => t.type!==T.SEPARATOR);
  if(tkns[0].value!=='SELECT') tkns.unshift(token(T.KEYWORD, 'SELECT'));
  tkns = stageRun(NULLORDER, s, tkns);
  tkns = stageRun(NUMBER, s, tkns);
  tkns = stageRun(LIMIT, s, tkns);
  tkns = stageRun(VALUE, s, tkns);
  tkns = stageRun(EXPRESSION, s, tkns, true, true);
  tkns = stageRun(ORDERBY, s, tkns, false, true);
  tkns = stageRun(GROUPBY, s, tkns, true);
  tkns = stageRun(HAVING, s, tkns);
  tkns = stageRun(WHERE, s, tkns);
  tkns = stageRun(FROM, s, tkns);
  tkns = stageRun(COLUMN, s, tkns);
  if(s.having.startsWith('AND ')) s.having = s.having.substring(4);
  if(s.where.startsWith('AND ')) s.where = s.where.substring(4);
  var i = s.columns.indexOf(`"*"`);
  if(i>=0) s.columns[i] = `*`;
  if(s.columns.length===0 || !s.columns.includes('*')) {
    for(var ord of s.orderBy) {
      var exp = ord.replace(/ (ASC|DESC)$/, '');
      if(!s.columns.includes(exp)) s.columns.push(exp);
    }
  }
  if(s.groupBy.length===0 && (s.columns.length===0 || !s.columns.includes('*'))) {
    for(var col of s.columnsUsed)
      if(!s.columns.includes(col)) s.columns.push(col);
  }
  for(var i=s.groupBy.length-1; i>=0; i--)
    s.columns.unshift(s.groupBy[i]);
  if(s.from.length===0) s.from.push(`"${opt.table}"`);
  // if(data.table(s.from[0].replace(/\"/g, ''))!=='compositions_tsvector') { if(s.columns.length===0) s.columns.push('*'); }
  if(s.from.includes(`"${opt.table}"`) && !s.columns.includes('*')) {
    Array.prototype.unshift.apply(s.columns, opt.columns||[]);
  }
  var z = `SELECT ${s.columns.join(', ')} FROM ${s.from.join(', ')}`;
  if(s.where.length>0) z += ` WHERE ${s.where}`;
  if(s.groupBy.length>0) z += ` GROUP BY ${s.groupBy.join(', ')}`;
  if(s.orderBy.length>0) z += ` ORDER BY ${s.orderBy.join(', ')}`;
  if(s.having.length>0) z += ` HAVING ${s.having}`;
  if(s.limit>0) z += ` LIMIT ${s.limit}`;
  return z;
};

async function english(txt, fn, ths=null, opt={}) {
  var tkns = token.parse(txt);
  tkns = number.process(tkns);
  tkns = unit.process(tkns);
  tkns = reserved.process(tkns);
  tkns = await entity.process(tkns, fn, ths);
  tkns = tkns.filter((v) => v.type!==T.TEXT || !/[~!@#$:,\?\.\|\/\\]/.test(v.value));
  if(tkns.length>0 && (tkns[0].type & 0xF0)!==T.KEYWORD) tkns.unshift(token(T.KEYWORD, 'SELECT'));
  return stageRunAll(tkns, opt);
};
english.token = token;
english.number = number;
english.unit = unit;
english.reserved = reserved;
english.entity = entity;
module.exports = english;
