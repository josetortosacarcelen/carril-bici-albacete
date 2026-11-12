# Carril Bici Albacete

Calcula la ruta más corta entre dos direcciones de Albacete **yendo solo por carril bici**.

## Cómo se usa

1. Escribe una dirección y pulsa **Enter** (o **Buscar**), o pulsa directamente en el mapa.
   **A** es el origen y **B** el destino.
2. La ruta aparece sola en cuanto hay dos puntos. Puedes arrastrar los marcadores.
   Si hay un pequeño rodeo por carril separado del tráfico, la ruta lo prefiere.
3. Con la ruta verás qué **estación de AlbaBici** te queda más cerca para coger una bici y para dejarla,
   y un botón para **descargar la ruta en GPX** (para Komoot, Strava, Garmin…).
4. En el mapa salen las **estaciones de AlbaBici** con las bicis libres en ese momento. Pulsa una y elige
   **Salir de aquí** o **Llegar aquí**. Si acercas el mapa, también salen los **aparcabicis**.
5. **Unir huecos**: en el mapa los carriles suelen cortarse en los cruces. Este control permite saltar cortes
   de hasta X metros. Esos saltos se dibujan en naranja y se cuentan aparte. Con 0 m solo se usa carril.

¿Falta un carril o está mal? Corrígelo en [openstreetmap.org](https://www.openstreetmap.org): la app lo recoge en el siguiente despliegue.

## Probarla en tu ordenador

Necesitas [Node.js](https://nodejs.org) 18 o superior y Python 3.

```bash
npm start        # abre http://localhost:8000
npm ci           # solo la primera vez: instala TypeScript para las comprobaciones
npm run check    # comprueba los tipos y pasa los tests
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
| Carriles bici y aparcabicis | OpenStreetMap, descargados al publicar |
| Direcciones | Nominatim (OpenStreetMap). Máximo una búsqueda por segundo |
| Estaciones de AlbaBici | [CityBikes](https://citybik.es), en tiempo real |
| Mapa de fondo | Teselas de OpenStreetMap. Valen para poco tráfico |

Todo es gratuito y no necesita claves.

## Cómo está hecho

Web estática en JavaScript, sin dependencias. Todo se sirve desde la propia web: no carga nada de Google ni de otros servidores, salvo los datos de la tabla anterior.

- `js/domain/` — cálculo de rutas (grafo y algoritmo A*).
- `js/application/` — convierte los carriles en grafo y calcula la ruta.
- `js/infrastructure/` — conexión con OpenStreetMap y Nominatim.
- `js/ui/` — mapa y panel.
- `js/config.js` — ciudad y parámetros. Para usarla en otra ciudad basta con cambiar este archivo.

## Licencia

MIT. Ver [LICENSE](LICENSE).
