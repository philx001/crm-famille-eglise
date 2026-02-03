// ============================================
// MODULE GRAPHIQUES - Wrapper Chart.js
// Graphiques visuels et interactifs pour les statistiques
// ============================================

const ChartsHelper = {
  // Références aux instances pour éviter les fuites mémoire
  instances: {},

  // Options par défaut (responsive, couleurs harmonieuses)
  defaultOptions: {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: { position: 'bottom' }
    }
  },

  // Créer un graphique donut/camembert
  createDoughnut(canvasId, labels, data, colors) {
    this.destroy(canvasId);
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return null;
    const palette = colors || ['#2D5A7B', '#4CAF50', '#FF9800', '#9C27B0', '#2196F3', '#E91E63'];
    this.instances[canvasId] = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{ data: data, backgroundColor: palette.slice(0, data.length), borderWidth: 2 }]
      },
      options: { ...this.defaultOptions, cutout: '60%' }
    });
    return this.instances[canvasId];
  },

  // Créer un graphique barres horizontales (colors peut être une couleur unique ou un tableau par barre)
  createBar(canvasId, labels, data, colors) {
    this.destroy(canvasId);
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return null;
    const bgColor = Array.isArray(colors) && colors.length === data.length ? colors : (colors || ['#2D5A7B']);
    this.instances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{ label: 'Taux présence (%)', data: data, backgroundColor: bgColor }]
      },
      options: {
        ...this.defaultOptions,
        indexAxis: 'y',
        scales: { x: { beginAtZero: true }, y: { ticks: { maxRotation: 0 } } }
      }
    });
    return this.instances[canvasId];
  },

  // Créer un graphique barres verticales
  createBarVertical(canvasId, labels, datasets) {
    this.destroy(canvasId);
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return null;
    const colors = ['#2D5A7B', '#4CAF50', '#FF9800', '#2196F3'];
    const ds = datasets.map((d, i) => ({
      label: d.label,
      data: d.data,
      backgroundColor: d.color || colors[i % colors.length]
    }));
    this.instances[canvasId] = new Chart(ctx, {
      type: 'bar',
      data: { labels, datasets: ds },
      options: {
        ...this.defaultOptions,
        scales: { y: { beginAtZero: true } }
      }
    });
    return this.instances[canvasId];
  },

  // Créer un graphique courbe/évolution
  createLine(canvasId, labels, datasets) {
    this.destroy(canvasId);
    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return null;
    const colors = ['#2D5A7B', '#4CAF50', '#FF9800'];
    const ds = datasets.map((d, i) => ({
      label: d.label,
      data: d.data,
      borderColor: d.color || colors[i % colors.length],
      backgroundColor: (d.color || colors[i % colors.length]) + '20',
      fill: d.fill !== false,
      tension: 0.3
    }));
    this.instances[canvasId] = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets: ds },
      options: {
        ...this.defaultOptions,
        scales: { y: { beginAtZero: true } }
      }
    });
    return this.instances[canvasId];
  },

  // Détruire une instance pour éviter les doublons
  destroy(canvasId) {
    if (this.instances[canvasId]) {
      this.instances[canvasId].destroy();
      delete this.instances[canvasId];
    }
  }
};
