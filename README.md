# Carril Bici Albacete

Calcula la ruta más corta entre dos direcciones de Albacete **yendo solo por carril bici**.

## Cómo se usa

1. Escribe una dirección y pulsa **Enter** (o **Buscar**), o pulsa directamente en el mapa.
   **A** es el origen y **B** el destino.
2. La ruta aparece sola en cuanto hay dos puntos. Puedes arrastrar los marcadores.
3. Las **estaciones de AlbaBici** salen en el mapa con las bicis libres en ese momento. Pulsa una y elige
   **Salir de aquí** o **Llegar aquí** para usarla como origen o destino.
4. **Unir huecos**: en el mapa los carriles suelen cortarse en los cruces. Este control permite saltar cortes
   de hasta X metros. Esos saltos se dibujan en naranja y se cuentan aparte. Con 0 m solo se usa carril.

¿Falta un carril o está mal? Corrígelo en [openstreetmap.org](https://www.openstreetmap.org): la app lo recoge en el siguiente despliegue.

## Probarla en tu ordenador

Necesitas [Node.js](https://nodejs.org) 18 o superior y Python 3. No hay que instalar nada más.

```bash
npm start      # abre http://localhost:8000
npm test       # pasa los tests
```

No funciona abriendo `index.html` con doble clic: hay que servirla con `npm start`.

## Publicarla

Se publica gratis en GitHub Pages con el flujo `.github/workflows/deploy.yml`, que:

1. Pasa los tests.
2. Descarga la red de carril bici de OpenStreetMap.
3. Publica la web.

Si algo falla, no se publica y sigue en línea la versión anterior.

**Ahora mismo el despliegue es manual**: en GitHub, **Actions → Desplegar → Run workflow**.
(Lo normal es que se ejecute solo en cada cambio y cada lunes; está pausado temporalmente.)

Dirección de la web: <https://josetortosacarcelen.github.io/carril-bici-albacete/>

## De dónde salen los datos

| Qué | Servicio |
|---|---|
| Carriles bici | OpenStreetMap, descargados al publicar |
| Direcciones | Nominatim (OpenStreetMap). Máximo una búsqueda por segundo |
| Estaciones de AlbaBici | [CityBikes](https://citybik.es), en tiempo real |
| Mapa de fondo | Teselas de OpenStreetMap. Valen para poco tráfico |

Todo es gratuito y no necesita claves.

## Cómo está hecho

Web estática en JavaScript, sin dependencias ni compilación.

- `js/domain/` — cálculo de rutas (grafo y algoritmo A*).
- `js/application/` — convierte los carriles en grafo y calcula la ruta.
- `js/infrastructure/` — conexión con OpenStreetMap y Nominatim.
- `js/ui/` — mapa y panel.
- `js/config.js` — ciudad y parámetros. Para usarla en otra ciudad basta con cambiar este archivo.

## Licencia

MIT. Ver [LICENSE](LICENSE).
