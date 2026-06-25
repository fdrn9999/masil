// TRUST BOUNDARY: expr/cond strings come exclusively from the Task-7 converter
// (author-authored Ren'Py scripts compiled offline). They are NOT runtime user input.
// new Function() is intentional per the engine spec; do not pass untrusted strings here.
export function makeEvaluator(state, sys) {
  const P = state.persistent;
  return {
    run(expr) {
      const fn = new Function('V', 'S', 'P', `"use strict"; ${expr};`);
      return fn(state.vars, sys, P);
    },
    test(cond) {
      const fn = new Function('V', 'S', 'P', `"use strict"; return (${cond});`);
      return !!fn(state.vars, sys, P);
    },
  };
}
