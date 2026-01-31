# Git Hooks

Este directorio contiene git hooks configurados con Husky.

## pre-commit

Se ejecuta automáticamente **antes de cada commit** y valida:
- ✅ ESLint en el API (detecta errores críticos)

Si la validación falla, el commit se cancela y debes arreglar los errores primero.

## Saltar el hook (solo en emergencias)

Si necesitas hacer commit sin validación (no recomendado):
```bash
git commit --no-verify -m "mensaje"
```
