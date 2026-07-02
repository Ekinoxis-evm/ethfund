# ESPECIFICACIÓN FUNCIONAL

# Scanner de Arbitraje Temporal para Polymarket

**Versión:** 1.0

**Autor:** Cristian Filadelfo Caicedo Tenorio

---

# 1\. Objetivo

El objetivo de este proyecto es desarrollar un scanner que monitoree continuamente los mercados **ETH Up or Down** de Polymarket para detectar oportunidades de arbitraje entre mercados con diferentes duraciones (4 horas, 1 hora, 15 minutos y 5 minutos) que finalizan exactamente al mismo tiempo.

La estrategia **no busca predecir el precio de Ethereum**, sino detectar diferencias de valoración entre mercados que representan prácticamente el mismo evento durante el tiempo restante.

El sistema debe funcionar en tiempo real y alertar únicamente cuando exista una diferencia suficiente para justificar una operación.

---

# 2\. Descripción de la Estrategia

Polymarket ofrece múltiples mercados simultáneos para Ethereum.

Ejemplo:

* ETH Up or Down 4H

* ETH Up or Down Hourly

* ETH Up or Down 15 Minutes

* ETH Up or Down 5 Minutes

Cada uno inicia en un momento distinto y posee un **Price To Beat** diferente.

Sin embargo, en determinados momentos dos mercados terminan exactamente a la misma hora.

Ejemplo:

| Mercado | Inicio | Final |
| :---- | :---- | :---- |
| 4 Horas | 12:00 PM | 4:00 PM |
| 1 Hora | 3:00 PM | 4:00 PM |

Ambos terminan exactamente a las 4:00 PM.

Durante esa última hora ambos mercados dependen prácticamente del mismo movimiento de ETH.

A pesar de ello, muchas veces el mercado asigna probabilidades diferentes.

Ahí aparece la oportunidad de arbitraje.

---

# 3\. Hipótesis

La hipótesis de esta estrategia es la siguiente:

Cuando dos mercados poseen exactamente el mismo momento de expiración, sus probabilidades deberían converger conforme disminuye el tiempo restante.

Si ambos mercados representan el mismo evento pero muestran precios diferentes para YES o NO, existe una ineficiencia temporal que puede ser aprovechada.

---

# 4\. Fundamento Matemático

Cada mercado posee un Price To Beat.

Ejemplo:

Mercado 4H

Price To Beat \= 1567.75

Precio actual ETH \= 1562.06

Distancia

1562.06 \- 1567.75 \= \-5.69 USD

---

Mercado 1H

Price To Beat \= 1567.56

Precio actual ETH \= 1565.23

Distancia

1565.23 \- 1567.56 \= \-2.33 USD

Aunque ambos mercados terminan al mismo tiempo, el riesgo restante es diferente.

Sin embargo, muchas veces la diferencia entre ambas probabilidades supera lo razonable.

---

# 5\. Ejemplo Visual

Supongamos:

Mercado 4H

YES \= 0.61

NO \= 0.39

---

Mercado 1H

YES \= 0.55

NO \= 0.45

Diferencia:

YES

0.61 \- 0.55 \= 0.06

Existe un spread de 6%.

Si el umbral configurado es del 5%, el scanner deberá generar una alerta.

---

# 6\. ¿Qué es una oportunidad de arbitraje?

Se considera arbitraje cuando dos mercados que vencen exactamente al mismo tiempo muestran probabilidades diferentes para el mismo resultado.

Ejemplo:

4H

YES \= 63%

1H

YES \= 56%

Existe una diferencia del 7%.

El operador puede comprar el mercado infravalorado esperando que ambos converjan antes del vencimiento.

---

# 7\. Comparaciones que debe realizar el Scanner

## 4H vs 1H

Condición:

Cuando al mercado de 4 horas le reste exactamente una hora.

Ejemplo:

12 PM → 4 PM

contra

3 PM → 4 PM

---

## 1H vs 15M

Cuando resten quince minutos.

Ejemplo

3 PM → 4 PM

contra

3:45 PM → 4 PM

---

## 15M vs 5M

Cuando resten cinco minutos.

Ejemplo

3:45 PM → 4 PM

contra

3:55 PM → 4 PM

---

## Comparaciones opcionales

4H vs 15M

4H vs 5M

1H vs 5M

Estas comparaciones pueden mostrar oportunidades adicionales.

---

# 8\. Información que debe obtener el Scanner

Para cada mercado deberá obtener:

* Nombre del mercado

* Token ID

* Hora de inicio

* Hora de finalización

* Price To Beat

* Precio actual de ETH

* Precio YES

* Precio NO

* Mejor Bid

* Mejor Ask

* Spread Bid/Ask

* Liquidez

* Volumen

* Estado del mercado

---

# 9\. Agrupación de mercados

El algoritmo debe agrupar los mercados por hora de vencimiento.

Ejemplo:

Expiran a las 4:00 PM

* ETH 4H

* ETH 1H

Expiran a las 5:00 PM

* ETH 4H

* ETH 1H

Expiran a las 4:15 PM

* ETH 15M

* ETH 5M

Solo se compararán mercados dentro del mismo grupo de expiración.

---

# 10\. Algoritmo del Scanner

Cada segundo deberá realizar el siguiente proceso:

1. Obtener todos los mercados activos.

2. Filtrar únicamente ETH Up/Down.

3. Agrupar por hora de expiración.

4. Comparar todos los mercados compatibles.

5. Calcular diferencia entre YES.

6. Calcular diferencia entre NO.

7. Calcular spread.

8. Verificar liquidez.

9. Verificar volumen.

10. Mostrar alerta.

---

# 11\. Fórmulas

Spread YES

Spread \= |YES Mercado A − YES Mercado B|

Spread NO

Spread \= |NO Mercado A − NO Mercado B|

Rentabilidad Potencial

Ganancia \= Spread \- Costos \- Slippage

---

# 12\. Condiciones para generar alerta

Mostrar alerta únicamente cuando:

✔ Ambos mercados tengan exactamente la misma hora de vencimiento.

✔ Diferencia mayor al umbral.

✔ Liquidez suficiente.

✔ Spread Bid/Ask aceptable.

✔ Mercado abierto.

---

# 13\. Configuración

El usuario podrá configurar:

Spread mínimo

Ejemplo

5%

Liquidez mínima

Ejemplo

5.000 USDC

Volumen mínimo

Ejemplo

20.000 USDC

Frecuencia de actualización

500 ms

1 segundo

2 segundos

---

# 14\. Interfaz Propuesta

---

ETH

4H vs 1H

Expiran

4:00 PM

YES 4H

0.63

YES 1H

0.57

Spread

6%

Liquidez

$18.000

Volumen

$235.000

Tiempo restante

58m

Estado

🟢 OPORTUNIDAD

---

---

# 15\. Historial

El scanner deberá almacenar:

Fecha

Hora

Mercado

Spread

Liquidez

Volumen

Tiempo restante

Resultado final

Esto permitirá hacer backtesting posteriormente.

---

# 16\. Ejemplo Completo

Hora actual

3:01 PM

Mercados disponibles

ETH 12-4 PM

Price To Beat

1567.75

YES

0.64

---

ETH 3-4 PM

Price To Beat

1567.56

YES

0.56

---

Diferencia

8%

Liquidez

25.000 USDC

Volumen

180.000 USDC

Resultado

ALERTA

El operador analiza si la diferencia puede cerrarse antes del vencimiento.

---

# 17\. Posibles Mejoras (Versión 2\)

Una vez desarrollado el scanner básico, se pueden añadir las siguientes funcionalidades:

## Backtesting

Guardar todas las oportunidades detectadas para analizar cuántas convergieron y cuánto beneficio potencial ofrecieron.

## Dashboard de estadísticas

Mostrar métricas como:

* Número de oportunidades por día.

* Spread promedio.

* Spread máximo.

* Tiempo promedio hasta la convergencia.

* Rentabilidad histórica.

## Ranking de oportunidades

Ordenar automáticamente los arbitrajes según:

* Mayor spread.

* Mayor liquidez.

* Mayor volumen.

* Menor tiempo restante.

## Alertas

Enviar notificaciones mediante:

* Sonido.

* Ventana emergente.

* Telegram.

* Discord.

* Correo electrónico.

## Ejecución automática (Versión 3\)

En una fase posterior, el scanner podrá conectarse a la API de Polymarket para ejecutar automáticamente las operaciones cuando se cumplan las condiciones configuradas por el usuario.

---

# 18\. Consideraciones Técnicas para el Desarrollo

El desarrollador deberá consumir la API o el CLOB de Polymarket para obtener datos en tiempo real.

El scanner debe estar diseñado de forma modular para permitir agregar nuevos mercados (BTC, SOL, índices, etc.) sin modificar la lógica principal.

Se recomienda utilizar WebSockets para minimizar la latencia y actualizar la información en tiempo real.

El sistema debe separar claramente los módulos de adquisición de datos, procesamiento, generación de alertas y presentación de la interfaz.

---

# 19\. Objetivo Final

El propósito del scanner es identificar ineficiencias temporales entre mercados equivalentes antes de que converjan, permitiendo al operador aprovechar diferencias de precio sin depender de una predicción direccional del mercado.

El éxito de la estrategia dependerá de la rapidez en la detección, la liquidez disponible y la velocidad con la que las probabilidades converjan antes del vencimiento de los mercados.