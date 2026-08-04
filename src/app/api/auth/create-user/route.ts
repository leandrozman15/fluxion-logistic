import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { getFirebaseAdminAuth, getFirebaseAdminFirestore } from '@/lib/firebase-admin';

const ALLOWED_USER_ROLES = new Set([
  'admin',
  'sales_admin',
  'purchasing_admin',
  'coordinator',
  'manager',
  'warehouse',
  'driver',
  'viewer',
]);

/**
 * Crea la cuenta de Firebase Auth para un nuevo usuario del ecosistema.
 * Solo el backend Express tiene la tabla AppUser, pero solo Next.js tiene
 * credenciales de Firebase Admin, por eso este paso vive acá antes de
 * insertar la fila en Postgres vía POST /api/users.
 */
export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null;

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return NextResponse.json({ success: false, message: 'JWT_SECRET no configurado' }, { status: 500 });
  }

  if (!token) {
    return NextResponse.json({ success: false, message: 'Falta el token de sesión' }, { status: 401 });
  }

  let sessionRole: string;
  let sessionTenantId: string;
  try {
    const decoded = jwt.verify(token, secret) as { role?: string; tenantId?: string };
    sessionRole = decoded.role || '';
    sessionTenantId = decoded.tenantId || '';
  } catch {
    return NextResponse.json({ success: false, message: 'Token de sesión inválido o expirado' }, { status: 401 });
  }

  if (sessionRole !== 'superadmin' && sessionRole !== 'platform_admin' && sessionRole !== 'admin' && sessionRole !== 'manager') {
    return NextResponse.json({ success: false, message: 'No autorizado para crear usuarios' }, { status: 403 });
  }

  const { email, password, displayName, tenantId, role } = await request.json();
  if (!email || !password || !tenantId || !ALLOWED_USER_ROLES.has(role)) {
    return NextResponse.json({ success: false, message: 'email, password, tenantId y role válidos son obligatorios' }, { status: 400 });
  }

  const isPlatformAdmin = sessionRole === 'superadmin' || sessionRole === 'platform_admin';
  if (!isPlatformAdmin && tenantId !== sessionTenantId) {
    return NextResponse.json({ success: false, message: 'No autorizado para crear usuarios en otro tenant' }, { status: 403 });
  }

  try {
    const cleanEmail = String(email).toLowerCase().trim();
    const userRecord = await getFirebaseAdminAuth().createUser({
      email: cleanEmail,
      password,
      displayName: displayName || undefined,
    });

    await getFirebaseAdminFirestore().doc(`users/${cleanEmail}`).set({
      uid: userRecord.uid,
      email: cleanEmail,
      displayName: displayName || null,
      tenantId,
      role,
      status: 'active',
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, uid: userRecord.uid });
  } catch (error: any) {
    const isEmailExists = error?.errorInfo?.code === 'auth/email-already-exists';
    const message = isEmailExists
      ? 'Ya existe un usuario con ese email en Firebase Auth'
      : error?.errorInfo?.message || error?.message || 'No se pudo crear el usuario en Firebase Auth';

    return NextResponse.json({ success: false, message }, { status: isEmailExists ? 409 : 500 });
  }
}
