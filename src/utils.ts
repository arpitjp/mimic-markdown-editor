export const debounce = function (fn: Function, ms: number = 1000): any {
  let timeout: NodeJS.Timeout;
  return (...args: any) => {
    timeout && clearTimeout(timeout);
    timeout = setTimeout(() => {
      fn(...args);
    }, ms);
  };
};

let debugMode: boolean = false;
export const isDebugMode = () => debugMode;
export const setDebugMode = (val: boolean) => debugMode = val; 

export const debug = function (...args: any) {
  if (!isDebugMode()) {
    return;
  }
  console.log("MIMIC:\t", ...args);
};