import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { getFirebaseAdminAuth, getFirebaseAdminFirestore } from '@/lib/firebase-admin';

const SUPER_ADMIN_EMAIL = 'leozman15@gmail.com';

/**
 * Intercambia un ID token de Firebase por el JWT propio que exige el backend
 * de Render (mismo JWT_SECRET configurado en ambos lados).
 *
 * El tenantId/role NO se leen de custom claims (nunca se asignan en este
 * proyecto); la fuente real es el documento Firestore /users/{email},
 * igual que usa el hook useTenant() en el resto de la app.
 */
export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  const idToken = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : null;

  if (!idToken) {
    return NextResponse.json({ success: false, message: 'Falta el ID token de Firebase' }, { status: 401 });
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return NextResponse.json({ success: false, message: 'JWT_SECRET no configurado' }, { status: 500 });
  }

  try {
    const decoded = await getFirebaseAdminAuth().verifyIdToken(idToken);
    const email = decoded.email?.toLowerCase().trim();

    let tenantId = '';
    let role = 'viewer';

    if (email === SUPER_ADMIN_EMAIL) {
      tenantId = 'default_tenant';
      role = 'admin';
    } else if (email) {
      const snapshot = await getFirebaseAdminFirestore().doc(`users/${email}`).get();
      const data = snapshot.data();
      tenantId = data?.tenantId || '';
      role = data?.role || 'viewer';
    }

    if (!tenantId) {
      return NextResponse.json(
        { success: false, message: 'El usuario no tiene un perfil/tenant asignado' },
        { status: 403 }
      );
    }

    const token = jwt.sign(
      { tenantId, role, email: decoded.email },
      secret,
      { subject: decoded.uid, expiresIn: '1h' }
    );

    return NextResponse.json({ success: true, token });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: (error as Error).message || 'Token de Firebase inválido' },
      { status: 401 }
    );
  }
}
