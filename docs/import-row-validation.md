# Importación: pendientes visibles — ZA-95

Los motivos de una fila pendiente o inválida se muestran permanentemente en su celda de estado y se asocian mediante aria-describedby a los selectores de cuenta, sobre y tipo. El texto original permanece visible sin truncamiento. No es necesario hover para leer los bloqueos.

El contador de válidos y el envío usan importableTransactions, la misma selección validada con cuentas activas y sobres disponibles. Solo se envían esas filas; las pendientes no se intentan ni se cuentan como fallos de guardado. Los estados warning actuales representan requisitos bloqueantes y se presentan como Pendiente, sin prometer que son advertencias importables. Al completar un requisito se presenta el siguiente pendiente; cargar sobres recalcula la validación.

Sin cambios de API o DB. La recuperación de importaciones parciales y prevención de duplicados siguen en ZA-96. Trabajo local en staging, sin push ni deploy.
