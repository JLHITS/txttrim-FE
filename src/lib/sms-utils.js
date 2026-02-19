export const getFragmentCount = (len) => Math.ceil(len / 160) || 1;

export const getFragmentColor = (count) =>
  count === 1
    ? "text-green-600 dark:text-green-400"
    : count === 2
      ? "text-yellow-600 dark:text-yellow-400"
      : "text-red-600 dark:text-red-400";
