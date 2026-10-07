/** Current unix time in seconds. A named helper so server components read the clock in one place. */
export const nowSec = () => Math.floor(Date.now() / 1000);
