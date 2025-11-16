import { getFirestore, doc, getDocs } from 'firebase/firestore';
import { NativeBlocker } from 'react-native-blocker';

export function subscribeToRemoteAppStatus(familyId: string, childId: string) {
    const db = getFirestore();
    let appControlsRef = doc(db, `families/${familyId}/children/${childId}/appControls`);
    let snapshot = await getDocs(appControlsRef);

    // Fallback to legacy path if family path doesn't exist
    if (snapshot.empty) {
        appControlsRef = doc(db, `children/${childId}/appControls`);
        snapshot = await getDocs(appControlsRef);
    }

    snapshot.forEach(doc => {
        const data = doc.data();
        if (data.blocked) {
            // Use custom blockMessage if available, otherwise default
            const blockMessage = data.blockMessage || "Blocked by Parent";
            // Pass blockMessage to native blocker
            blockApp(data.packageName, blockMessage);
        }
    });
}

// Helper function to block app with custom message
function blockApp(packageName: string, blockMessage: string) {
    // Call native blocker, passing blockMessage
    NativeBlocker.block(packageName, blockMessage);
}