# Hextech Boost - Backend API

Backend API para el servicio de Elo Boosting de League of Legends.

## 🚀 Tecnologías

- **Node.js** + **Express** - Framework web
- **SQLite** (better-sqlite3) - Base de datos
- **JWT** - Autenticación
- **bcryptjs** - Hash de contraseñas

## 📦 Instalación

```bash
npm install
```

## 🔧 Configuración

1. Copia el archivo `.env.example` a `.env`:
```bash
cp .env.example .env
```

2. Edita `.env` con tus configuraciones (opcional, los valores por defecto funcionan)

## 🗄️ Inicializar Base de Datos

```bash
npm run init-db
```

Esto creará las tablas y datos de ejemplo:
- **Admin**: admin@hextech.com / password123
- **Cliente**: client@test.com / password123
- **Boosters**: apexvayne@hextech.com / password123

## 🏃 Ejecutar

### Desarrollo (con auto-reload)
```bash
npm run dev
```

### Producción
```bash
npm start
```

El servidor estará disponible en `http://localhost:3000`

## 📚 Endpoints

### Autenticación
- `POST /api/auth/register` - Registrar usuario (client o booster)
- `POST /api/auth/login` - Login
- `GET /api/auth/profile` - Obtener perfil (requiere token)

### Boosters
- `GET /api/boosters` - Listar todos los boosters disponibles
- `GET /api/boosters/:id` - Obtener perfil de booster específico
- `GET /api/boosters/me/profile` - Obtener mi perfil de booster (requiere token booster)
- `POST /api/boosters/me/profile` - Crear/actualizar perfil de booster (requiere token booster)
- `PATCH /api/boosters/me/availability` - Toggle disponibilidad (requiere token booster)

### Órdenes
- `POST /api/orders` - Crear orden (requiere token client)
- `GET /api/orders/my-orders` - Mis órdenes como cliente (requiere token client)
- `GET /api/orders/my-booster-orders` - Mis órdenes como booster (requiere token booster)
- `GET /api/orders/:id` - Obtener orden específica (requiere token)
- `PATCH /api/orders/:id/status` - Actualizar estado de orden (requiere token booster/admin)
- `PATCH /api/orders/:id/progress` - Actualizar progreso (LP, %) (requiere token booster/admin)

### Partidas
- `POST /api/matches/order/:order_id` - Agregar partida a orden (requiere token booster)
- `GET /api/matches/order/:order_id` - Obtener partidas de orden (requiere token)
- `DELETE /api/matches/:id` - Eliminar partida (requiere token booster/admin)

### Reviews
- `POST /api/reviews` - Crear review (requiere token client)
- `GET /api/reviews/booster/:booster_id` - Obtener reviews de booster
- `GET /api/reviews/all` - Todas las reviews (requiere token admin)

## 🔐 Autenticación

Todas las rutas protegidas requieren un header:
```
Authorization: Bearer <token>
```

El token se obtiene al hacer login o registro.

## 📊 Estructura de la Base de Datos

### users
- Usuarios del sistema (clients, boosters, admins)

### booster_profiles
- Perfiles completos de boosters con precios, stats, etc.

### orders
- Órdenes de boost creadas por clientes

### matches
- Partidas jugadas en cada orden

### reviews
- Reseñas de clientes a boosters

## 🎯 Flujo de Uso

1. **Booster** se registra con role='booster'
2. **Booster** completa su perfil con precios y stats
3. **Cliente** ve lista de boosters disponibles
4. **Cliente** crea orden eligiendo un booster
5. **Booster** actualiza progreso y agrega partidas
6. **Cliente** deja review al completar

## 📝 Notas

- Los pagos están fuera del scope por ahora
- El chat está fuera del scope por ahora
- WebSockets para tiempo real está fuera del scope por ahora
