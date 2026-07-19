export function countChar(str, char) {
  if (!str) return 0;
  let count = 0;
  for (let i = 0; i < str.length; i++) {
    if (str[i] === char) count++;
  }
  return count;
}

export function countVowels(str) {
  if (!str) return 0;
  let count = 0;
  const vowels = 'aeiouAEIOU';
  for (let i = 0; i < str.length; i++) {
    if (vowels.indexOf(str[i]) !== -1) count++;
  }
  return count;
}
