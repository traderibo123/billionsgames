function buildShareUrl({ score, acc, seconds }) {
  const text = `I just played Real vs Fake Swipe by @billions_ntwk 👓
Score: ${score} | Accuracy: ${acc}% | Time: ${seconds}s
#Billions #RealHuman`;
  return 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(text);
}
