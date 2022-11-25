import { existsSync, unlinkSync } from 'fs';
import { Access, openKey, HKCU, HKEY, setValueSZ, queryValue, deleteValue } from "native-reg";
import { join, dirname, basename } from "path";
const winlink = require("winlink");

export interface AutoLaunchWindows {
	enable: typeof enable;
	disable: typeof disable;
	isEnabled: typeof isEnabled;
}

const startupFolder = join(process.env.APPDATA || '', "Microsoft", "Windows", "Start Menu", "Programs", "Startup");

export function enable({ appName, appPath, isHiddenOnLaunch }: {
	appName: string;
	appPath: string;
	isHiddenOnLaunch: boolean;
}) {
	return new Promise<boolean | Error>(function (resolve, reject) {
		let pathToAutoLaunchedApp = appPath;
		let args = "";
		const updateDotExe = join(
			dirname(process.execPath),
			"..",
			"update.exe"
		);

		// If they're using Electron and Squirrel.Windows, point to its Update.exe instead
		// Otherwise, we'll auto-launch an old version after the app has updated
		if (
			(process.versions != null
				? process.versions.electron
				: undefined) != null &&
			existsSync(updateDotExe)
		) {
			pathToAutoLaunchedApp = updateDotExe;
			args = ` --processStart \"${basename(process.execPath)}\"`;
			if (isHiddenOnLaunch) {
				args += ' --process-start-args "--hidden"';
			}
		} else {
			if (isHiddenOnLaunch) {
				args += " --hidden";
			}
		}

		try {
			const key = openAutostartKey();
			setValueSZ(key, appName, `"${pathToAutoLaunchedApp}"${args}`);
		} catch (error) {
			// Apply fallback via auto-lauch entry in startmenu
			winlink.writeFile(join(startupFolder, `${appName}.lnk`), pathToAutoLaunchedApp, args, function (err: any) {
				if (err) {
					return reject(err);
				} else {
					return resolve(true);
				}
			});
		}

		resolve(true);
	});
}
export function disable(appName: string) {
	return new Promise<boolean | Error>((resolve, reject) => {
		try {
			if (existsSync(join(startupFolder, `${appName}.lnk`))) {
				unlinkSync(join(startupFolder, `${appName}.lnk`));
			}

			const key = openAutostartKey();
			if (queryValue(key, appName) != null) {
				deleteValue(key, appName);
			}
		} catch (error) { 
			return reject(error);
		}

		resolve(true);
	});
}
export function isEnabled(appName: string) {
	return new Promise<boolean | Error>((resolve, reject) => {
		try {
			if (existsSync(join(startupFolder, `${appName}.lnk`))) {
				return resolve(true);
			}

			const key = openAutostartKey();
			if (queryValue(key, appName) != null) {
				return resolve(true);
			}
		} catch (error) { 
			return reject(error);
		}

		resolve(false);
	});
}

/**
 * @throws {Error} if the key cannot be opened
 * @returns HKEY|null
 */
function openAutostartKey(): HKEY {
	const key = openKey(HKCU, "\\Software\\Microsoft\\Windows\\CurrentVersion\\Run", Access.ALL_ACCESS);
	if (key == null) {
		throw new Error("Cannot open registry key");
	}
	return key;
}
