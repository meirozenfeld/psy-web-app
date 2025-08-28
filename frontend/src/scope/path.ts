// src/scope/path.ts
import { collection, doc, type CollectionReference, type DocumentReference, type Firestore } from "firebase/firestore";
import { auth } from "../firebase";
import { useScope } from "./ScopeContext";

type ScopedFns = {
    /** collection under current scope (users/{uid}/sub | orgs/{orgId}/sub) */
    collection: (db: Firestore, sub: string) => CollectionReference;
    /** doc under current scope (users/{uid}/sub/{id} | orgs/{orgId}/sub/{id}) */
    doc: (db: Firestore, sub: string, id: string) => DocumentReference;
    /** root prefs doc for the current scope (users/{uid} | orgs/{orgId}) */
    rootDoc: (db: Firestore) => DocumentReference;
};

export function useScopedRefs(): ScopedFns {
    const { scope } = useScope();

    function pathPrefix(): [string, string] {
        if (scope.mode === "org") {
            if (!scope.orgId) throw new Error("Missing orgId for org scope");
            return ["orgs", scope.orgId];
        }
        // SOLO
        const uid = auth.currentUser?.uid;
        if (!uid) throw new Error("Missing uid for solo scope");
        return ["users", uid];
    }

    function collectionScoped(db: Firestore, sub: string): CollectionReference {
        const [root, id] = pathPrefix();
        return collection(db, root, id, sub);
    }

    function docScoped(db: Firestore, sub: string, id: string): DocumentReference {
        const [root, rid] = pathPrefix();
        return doc(db, root, rid, sub, id);
    }

    function rootDoc(db: Firestore): DocumentReference {
        const [root, id] = pathPrefix();
        return doc(db, root, id);
    }

    return { collection: collectionScoped, doc: docScoped, rootDoc };
}
