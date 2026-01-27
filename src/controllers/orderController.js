import { query, queryOne, run } from '../database/db.js';

// Generar número de orden único
function generateOrderNumber() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `HB-${timestamp}-${random}`;
}

// Obtener todas las órdenes (solo admin)
export const getAllOrders = async (req, res) => {
  try {
    const adminRole = req.user.role;

    if (adminRole !== 'admin') {
      return res.status(403).json({ error: 'Solo los administradores pueden ver todas las órdenes' });
    }

    const orders = query(`
      SELECT 
        o.*,
        u.username as client_username,
        bp.display_name as booster_display_name
      FROM orders o
      LEFT JOIN users u ON o.client_id = u.id
      LEFT JOIN booster_profiles bp ON o.booster_id = bp.user_id
      ORDER BY o.created_at DESC
    `, []);

    res.json({ orders });
  } catch (error) {
    console.error('Error fetching all orders:', error);
    res.status(500).json({ error: 'Error al obtener las órdenes' });
  }
};

// Crear nueva orden
export const createOrder = async (req, res) => {
  try {
    const clientId = req.user.id;
    const {
      booster_id,
      boost_type,
      current_rank,
      current_division,
      current_lp,
      desired_rank,
      desired_division,
      desired_lp,
      wins_requested,
      selected_champion,
      extras,
      total_price,
      discord_username,
      summoner_name,
      server
    } = req.body;

    // Validaciones
    if (!booster_id || !boost_type || !current_rank || !desired_rank || !total_price) {
      return res.status(400).json({ error: 'Faltan campos requeridos' });
    }

    if (!discord_username || !summoner_name) {
      return res.status(400).json({ error: 'Discord y nombre de invocador son requeridos' });
    }

    // Verificar que el booster existe
    const booster = queryOne('SELECT id FROM users WHERE id = ? AND role = ?', [booster_id, 'booster']);
    if (!booster) {
      return res.status(404).json({ error: 'Booster no encontrado' });
    }

    const orderNumber = generateOrderNumber();

    const result = run(`
      INSERT INTO orders (
        order_number, client_id, booster_id, status, boost_type,
        current_rank, current_division, current_lp,
        desired_rank, desired_division, desired_lp,
        wins_requested, selected_champion, extras, total_price,
        discord_username, summoner_name, server, payment_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      orderNumber, clientId, booster_id, 'pending', boost_type,
      current_rank, current_division || null, current_lp || 0,
      desired_rank, desired_division || null, desired_lp || 0,
      wins_requested || null, selected_champion || null, extras || null, total_price,
      discord_username, summoner_name, server || 'LAS', 'pending'
    ]);

    const order = queryOne('SELECT * FROM orders WHERE id = ?', [result.lastInsertRowid]);

    res.status(201).json({
      message: 'Orden creada exitosamente',
      order
    });
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ error: 'Error al crear la orden' });
  }
};

// Obtener órdenes del cliente
export const getMyOrders = async (req, res) => {
  try {
    const clientId = req.user.id;
    
    const orders = query(`
      SELECT 
        o.*,
        u.username as booster_username,
        bp.display_name as booster_display_name,
        bp.avatar_url as booster_avatar
      FROM orders o
      LEFT JOIN users u ON o.booster_id = u.id
      LEFT JOIN booster_profiles bp ON o.booster_id = bp.user_id
      WHERE o.client_id = ?
      ORDER BY o.created_at DESC
    `, [clientId]);

    res.json({ orders });
  } catch (error) {
    console.error('Error fetching client orders:', error);
    res.status(500).json({ error: 'Error al obtener órdenes' });
  }
};

// Obtener órdenes del booster
export const getBoosterOrders = async (req, res) => {
  try {
    const boosterId = req.user.id;
    
    const orders = query(`
      SELECT 
        o.*,
        u.username as client_username,
        u.email as client_email
      FROM orders o
      LEFT JOIN users u ON o.client_id = u.id
      WHERE o.booster_id = ?
      ORDER BY o.created_at DESC
    `, [boosterId]);

    res.json({ orders });
  } catch (error) {
    console.error('Error fetching booster orders:', error);
    res.status(500).json({ error: 'Error al obtener órdenes' });
  }
};

// Obtener una orden específica
export const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    const order = queryOne(`
      SELECT 
        o.*,
        client.username as client_username,
        client.email as client_email,
        booster.username as booster_username,
        bp.display_name as booster_display_name,
        bp.avatar_url as booster_avatar
      FROM orders o
      LEFT JOIN users client ON o.client_id = client.id
      LEFT JOIN users booster ON o.booster_id = booster.id
      LEFT JOIN booster_profiles bp ON o.booster_id = bp.user_id
      WHERE o.id = ?
    `, [id]);

    if (!order) {
      return res.status(404).json({ error: 'Orden no encontrada' });
    }

    // Verificar permisos
    if (userRole !== 'admin' && order.client_id !== userId && order.booster_id !== userId) {
      return res.status(403).json({ error: 'No tienes permiso para ver esta orden' });
    }

    // Obtener matches de la orden
    const matches = query('SELECT * FROM matches WHERE order_id = ? ORDER BY played_at DESC', [id]);

    res.json({ order, matches });
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({ error: 'Error al obtener la orden' });
  }
};

// Actualizar estado de la orden (booster)
export const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const boosterId = req.user.id;

    if (!['pending', 'in_progress', 'completed', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Estado inválido' });
    }

    const order = queryOne('SELECT * FROM orders WHERE id = ?', [id]);
    if (!order) {
      return res.status(404).json({ error: 'Orden no encontrada' });
    }

    // Solo el booster asignado puede actualizar
    if (order.booster_id !== boosterId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'No tienes permiso para actualizar esta orden' });
    }

    const updates = ['status = ?', 'updated_at = CURRENT_TIMESTAMP'];
    const params = [status];

    if (status === 'completed') {
      updates.push('completed_at = CURRENT_TIMESTAMP', 'progress_percentage = 100');
    }

    params.push(id);

    run(`UPDATE orders SET ${updates.join(', ')} WHERE id = ?`, params);

    const updatedOrder = queryOne('SELECT * FROM orders WHERE id = ?', [id]);

    res.json({
      message: 'Orden actualizada exitosamente',
      order: updatedOrder
    });
  } catch (error) {
    console.error('Error updating order:', error);
    res.status(500).json({ error: 'Error al actualizar la orden' });
  }
};

// Simular pago (fake payment)
export const processPayment = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { payment_method } = req.body;
    const clientId = req.user.id;

    if (!payment_method || !['transferencia', 'mercadopago'].includes(payment_method)) {
      return res.status(400).json({ error: 'Método de pago inválido' });
    }

    const order = queryOne('SELECT * FROM orders WHERE id = ?', [orderId]);
    if (!order) {
      return res.status(404).json({ error: 'Orden no encontrada' });
    }

    if (order.client_id !== clientId) {
      return res.status(403).json({ error: 'No tienes permiso para pagar esta orden' });
    }

    if (order.payment_status === 'completed') {
      return res.status(400).json({ error: 'Esta orden ya fue pagada' });
    }

    // Determinar el estado del pago según el método
    let paymentStatus = 'pending';
    let orderStatus = 'pending';
    
    if (payment_method === 'mercadopago') {
      // Mercado Pago se marca como completado automáticamente (simulado)
      paymentStatus = 'completed';
      orderStatus = 'in_progress';
    } else if (payment_method === 'transferencia') {
      // Transferencia queda pendiente hasta que un admin lo confirme
      paymentStatus = 'pending';
      orderStatus = 'pending';
    }

    // Actualizar orden con el método de pago y estado correspondiente
    run(`
      UPDATE orders 
      SET payment_status = ?, payment_method = ?, status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [paymentStatus, payment_method, orderStatus, orderId]);

    const updatedOrder = queryOne('SELECT * FROM orders WHERE id = ?', [orderId]);

    res.json({
      message: payment_method === 'transferencia' 
        ? 'Orden creada. El pago quedará pendiente hasta que un administrador confirme la transferencia.'
        : 'Pago procesado exitosamente',
      order: updatedOrder,
      requiresAdminApproval: payment_method === 'transferencia'
    });
  } catch (error) {
    console.error('Error processing payment:', error);
    res.status(500).json({ error: 'Error al procesar el pago' });
  }
};

// Aprobar pago (solo admin)
export const approvePayment = async (req, res) => {
  try {
    const { orderId } = req.params;
    const adminId = req.user.id;
    const adminRole = req.user.role;

    // Verificar que sea admin
    if (adminRole !== 'admin') {
      return res.status(403).json({ error: 'Solo los administradores pueden aprobar pagos' });
    }

    const order = queryOne('SELECT * FROM orders WHERE id = ?', [orderId]);
    if (!order) {
      return res.status(404).json({ error: 'Orden no encontrada' });
    }

    if (order.payment_status === 'completed') {
      return res.status(400).json({ error: 'Este pago ya fue aprobado' });
    }

    if (order.payment_method !== 'transferencia') {
      return res.status(400).json({ error: 'Solo se pueden aprobar pagos por transferencia' });
    }

    // Aprobar el pago y cambiar el estado de la orden
    run(`
      UPDATE orders 
      SET payment_status = 'completed', status = 'in_progress', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [orderId]);

    const updatedOrder = queryOne('SELECT * FROM orders WHERE id = ?', [orderId]);

    res.json({
      message: 'Pago aprobado exitosamente',
      order: updatedOrder
    });
  } catch (error) {
    console.error('Error approving payment:', error);
    res.status(500).json({ error: 'Error al aprobar el pago' });
  }
};

// Rechazar pago (solo admin)
export const rejectPayment = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body;
    const adminRole = req.user.role;

    // Verificar que sea admin
    if (adminRole !== 'admin') {
      return res.status(403).json({ error: 'Solo los administradores pueden rechazar pagos' });
    }

    const order = queryOne('SELECT * FROM orders WHERE id = ?', [orderId]);
    if (!order) {
      return res.status(404).json({ error: 'Orden no encontrada' });
    }

    if (order.payment_status === 'completed') {
      return res.status(400).json({ error: 'No se puede rechazar un pago ya aprobado' });
    }

    // Rechazar el pago y cancelar la orden
    run(`
      UPDATE orders 
      SET payment_status = 'failed', status = 'cancelled', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [orderId]);

    const updatedOrder = queryOne('SELECT * FROM orders WHERE id = ?', [orderId]);

    res.json({
      message: 'Pago rechazado',
      order: updatedOrder,
      reason: reason || 'No se especificó razón'
    });
  } catch (error) {
    console.error('Error rejecting payment:', error);
    res.status(500).json({ error: 'Error al rechazar el pago' });
  }
};

// Cancelar orden
export const cancelOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const order = queryOne('SELECT * FROM orders WHERE id = ?', [id]);
    if (!order) {
      return res.status(404).json({ error: 'Orden no encontrada' });
    }

    // Solo el cliente puede cancelar su orden
    if (order.client_id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'No tienes permiso para cancelar esta orden' });
    }

    if (order.status === 'completed') {
      return res.status(400).json({ error: 'No se puede cancelar una orden completada' });
    }

    run(`
      UPDATE orders 
      SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [id]);

    const updatedOrder = queryOne('SELECT * FROM orders WHERE id = ?', [id]);

    res.json({
      message: 'Orden cancelada exitosamente',
      order: updatedOrder
    });
  } catch (error) {
    console.error('Error cancelling order:', error);
    res.status(500).json({ error: 'Error al cancelar la orden' });
  }
};

// Alias para compatibilidad con rutas existentes
export const getMyBoosterOrders = getBoosterOrders;

// Actualizar progreso de la orden
export const updateOrderProgress = async (req, res) => {
  try {
    const { id } = req.params;
    const { progress_percentage } = req.body;
    const boosterId = req.user.id;

    if (progress_percentage < 0 || progress_percentage > 100) {
      return res.status(400).json({ error: 'Progreso debe estar entre 0 y 100' });
    }

    const order = queryOne('SELECT * FROM orders WHERE id = ?', [id]);
    if (!order) {
      return res.status(404).json({ error: 'Orden no encontrada' });
    }

    if (order.booster_id !== boosterId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'No tienes permiso para actualizar esta orden' });
    }

    run(`
      UPDATE orders 
      SET progress_percentage = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [progress_percentage, id]);

    const updatedOrder = queryOne('SELECT * FROM orders WHERE id = ?', [id]);

    res.json({
      message: 'Progreso actualizado exitosamente',
      order: updatedOrder
    });
  } catch (error) {
    console.error('Error updating progress:', error);
    res.status(500).json({ error: 'Error al actualizar el progreso' });
  }
};
