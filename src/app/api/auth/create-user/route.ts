import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { getFirebaseAdminAuth } from '@/lib/firebase-admin';

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

  let role: string;
  try {
    const decoded = jwt.verify(token, secret) as { role?: string };
    role = decoded.role || '';
  } catch {
    return NextResponse.json({ success: false, message: 'Token de sesión inválido o expirado' }, { status: 401 });
  }

  if (role !== 'superadmin' && role !== 'platform_admin' && role !== 'admin' && role !== 'manager') {
    return NextResponse.json({ success: false, message: 'No autorizado para crear usuarios' }, { status: 403 });
  }

  const { email, password, displayName } = await request.json();
  if (!email || !password) {
    return NextResponse.json({ success: false, message: 'email y password son obligatorios' }, { status: 400 });
  }

  try {
    const userRecord = await getFirebaseAdminAuth().createUser({
      email: String(email).toLowerCase().trim(),
      password,
      displayName: displayName || undefined,
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
