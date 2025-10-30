# Zillow Scraper CLI

Herramienta mínima en Node.js para obtener listados de propiedades desde una URL pública de Zillow (por ejemplo, búsquedas filtradas).

## Requisitos
- Node.js 18 o superior

## Uso

```bash
node src/scrape.js "https://www.zillow.com/homes/?category=SEMANTIC&searchQueryState=..."
```

También puedes instalar el comando globalmente dentro del proyecto:

```bash
npm install --global .
zillow-scraper "https://www.zillow.com/homes/?category=SEMANTIC&searchQueryState=..."
```

La salida muestra nombre, precio, tipo y URL del detalle de cada propiedad encontrada.

## Notas
- El script solo usa módulos nativos de Node.js para evitar dependencias externas.
- Para minimizar el riesgo de activar desafíos anti-bot, se envía un `User-Agent` y cabeceras comunes de navegadores.
- Si Zillow cambia la estructura del HTML, actualiza el selector dentro de `extractPropertiesFromHtml`.
