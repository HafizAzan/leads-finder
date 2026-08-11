import { FieldValue } from "firebase-admin/firestore";
import { collections, db } from "@/lib/firebase/firestore";
import { mapFirebaseError } from "@/lib/firebase/errors";

type EnsureUserInput = {
  id: string;
  email: string;
  name?: string;
};

export async function ensureUser(input: EnsureUserInput) {
  try {
    const ref = db().collection(collections.users).doc(input.id);
    const snap = await ref.get();

    if (!snap.exists) {
      await ref.set({
        id: input.id,
        email: input.email,
        name: input.name || null,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return;
    }

    await ref.set(
      {
        email: input.email,
        name: input.name || snap.data()?.name || null,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  } catch (error) {
    mapFirebaseError(error);
  }
}
