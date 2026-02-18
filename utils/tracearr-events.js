const EventEmitter = require('events');

/**
 * 📢 EventEmitter global pour notifier les clients quand le scan Tracearr finit
 * Évite 30 polls inutiles - le client s'abone simplement
 */
class TracearrEventsManager extends EventEmitter {
  constructor() {
    super();
    this.scanFinishTime = null;
  }

  /**
   * Émettre quand le scan global finit
   */
  emitScanComplete() {
    this.scanFinishTime = Date.now();
    console.log("[TRACEARR-EVENTS] 📢 Scan COMPLÉTÉ - Notification aux clients");
    this.emit('scan-complete');
  }

  /**
   * Client se subscribe pour attendre la fin du scan
   * Retourne une Promise qui resolve quand scan finit ou timeout
   */
  waitForScanComplete(timeout = 300000) {  // 5 min timeout par défaut
    return new Promise((resolve, reject) => {
      // Si scan déjà fini récemment (< 2 sec), resolve immédiatement
      if (this.scanFinishTime && (Date.now() - this.scanFinishTime < 2000)) {
        resolve();
        return;
      }

      // Sinon, attendre l'événement avec timeout
      const timeoutHandle = setTimeout(() => {
        this.removeListener('scan-complete', onScanComplete);
        console.warn("[TRACEARR-EVENTS] ⚠️  Timeout waitForScanComplete après", timeout, 'ms');
        resolve();  // Timeout = resolve quand même (pas reject pour ne pas bloquer le client)
      }, timeout);

      const onScanComplete = () => {
        clearTimeout(timeoutHandle);
        resolve();
      };

      // Se subscribe une fois seulement
      this.once('scan-complete', onScanComplete);
    });
  }
}

module.exports = new TracearrEventsManager();
