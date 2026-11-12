/** Tipos de arista del grafo de rutas. */
export const EdgeKind = Object.freeze({
  LANE: 'lane', // tramo de carril bici
  GAP: 'gap', // salto corto entre tramos (un cruce que el mapa no une)
  ACCESS: 'access', // del punto pedido al carril (solo en grafos temporales de una ruta)
});

/** Tipo de tramo de carril: separado del tráfico, pintado en la calzada o compartido con peatones. */
export const LaneKind = Object.freeze({ SEGREGATED: 'segregated', PAINTED: 'painted', SHARED: 'shared' });
