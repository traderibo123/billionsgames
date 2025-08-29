function buildShareUrl({ name, score, acc, seconds }) {
  const who = name && name.trim() ? name.trim() : 'Player';
  const text = `I played "Real vs Fake Swipe" by @billions_ntwk 👓
Name: ${who}
Score: ${score} | Accuracy: ${acc}% | Time: ${seconds}s
Produced by @traderibo123
#Billions #RealHuman`;
  return 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(text);
}
