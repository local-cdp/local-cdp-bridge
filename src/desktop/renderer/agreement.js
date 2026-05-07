const acceptTerms = document.querySelector('#acceptTerms');

async function initAgreement() {
  const status = await getLocalizedStatus();
  if (status.consentAccepted) {
    window.location.href = './home.html';
  }
}

acceptTerms.addEventListener('click', async () => {
  await window.bridgeDesktop.acceptTerms();
  window.location.href = './home.html';
});

initAgreement().catch(() => {});
