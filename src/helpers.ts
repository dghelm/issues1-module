import { callModule, getSeed, log } from "libkmodule"
import { taggedRegistryEntryKeys, resolverLink, b64ToBuf, deriveRegistryEntryID, bufToB64 } from "libskynet"
import { v4 as uuidv4 } from "uuid"
import { unpack, pack } from "msgpackr"

const secureUploadModule = "AQAT_a0MzOInZoJzt1CwBM2U8oQ3GIfP5yKKJu8Un-SfNg"
const secureDownloadModule = "MABeaYj7fqGWK3TvNmxsi7jV6zicErW1TZy5A6qk2nAYgQ" // mine
// const secureDownloadModule = "AQCIaQ0P-r6FwPEDq3auCZiuH_jqrHfqRcY7TjZ136Z_Yw" // real
const secureRegistryModule = "AQCovesg1AXUzKXLeRzQFILbjYMKr_rvNLsNhdq5GbYb2Q"

// uploads data to Skynet and saves to a registry entry
// uses host module's seed as basis for saving data
const persistToSkynet = async (data: any, keyPairTag: string, dataKeyTag: string) => {
	log(`uploading ${keyPairTag} + ${dataKeyTag}...`)
	// upload data to Skynet, packed to binary
	const [{ skylink }, uploadErr] = await callModule(secureUploadModule, "secureUpload", {
		filename: uuidv4(),
		fileData: pack(data),
	})
	if (uploadErr) {
		throw new Error(uploadErr)
	}
	log(`upload successful`)

	// grab our seed. Changing either tag results in output for both publicKey and dataKey.
	// Note: we're using the host module's seed as the basis for generating keys
	const seed = <Uint8Array>await getSeed
	const [keyPair, dataKey, keyPairErr] = taggedRegistryEntryKeys(seed, keyPairTag, dataKeyTag)
	if (keyPairErr) {
		throw new Error(keyPairErr)
	}

	// get current registry revision.
	const [result, registryReadErr] = await callModule(secureRegistryModule, "readEntry", {
		publicKey: keyPair.publicKey,
		dataKey: dataKey,
	})
	if (registryReadErr) {
		throw new Error(registryReadErr)
	}

	// determine next registry revision number
	let nextRevision = 0n
	if (result.exists) {
		nextRevision = result.revision + 1n
	}

	// convert our uploaded skylink to binary encoding for registry entry
	const [skylinkBinary, b64ToBufErr] = b64ToBuf(skylink)
	if (b64ToBufErr) {
		throw new Error(b64ToBufErr)
	}

	log(`writing registry for ${keyPairTag} + ${dataKeyTag}...`)
	// write the registry entry
	const [{ entryID }, registryWriteErr] = await callModule(secureRegistryModule, "writeEntry", {
		publicKey: keyPair.publicKey,
		secretKey: keyPair.secretKey,
		dataKey: dataKey,
		entryData: skylinkBinary,
		revision: nextRevision,
	})
	if (registryWriteErr) {
		throw new Error(registryWriteErr)
	}

	log(`writing registry successful`)

	// convert the registry entry's "entryID" to a resolver skylink
	const [resolverSkylink, resolverSkylinkErr] = resolverLink(b64ToBuf(entryID)[0])
	if (resolverSkylinkErr) {
		throw new Error(resolverSkylinkErr)
	}

	return resolverSkylink
}

// downloads data from Skynet and returns
// uses host module's seed as basis for retreiving data
const downloadFromSkynet = async (keyPairTag: string, dataKeyTag: string) => {
	// grab our keys and dataKey for finding resolver skylink
	const seed = <Uint8Array>await getSeed
	const [keyPair, dataKey, keyPairErr] = taggedRegistryEntryKeys(seed, keyPairTag, dataKeyTag)
	if (keyPairErr) {
		throw new Error(keyPairErr)
	}

	// TODO: FIX FOR RESOLVER SKYLINKS ONCE SECUREDOWNLOAD IS HAPPY WITH THEM

	// Generate entryID and Resolver skylink.
	// Because secureDownload supports resolver skylinks, we don't need to read from the registry.
	// The portal will read the registry entry and just provide secureDownload with the proof
	// alongside the data.
	const [entryID, entryIDErr] = deriveRegistryEntryID(keyPair.publicKey, dataKey)
	const [resolverSkylink, resolverSkylinkErr] = resolverLink(entryID)
	if (entryIDErr) {
		throw new Error(entryIDErr)
	}
	if (resolverSkylinkErr) {
		throw new Error(resolverSkylinkErr)
	}

	// TODO: READ FROM REGISTRY TO GRAB SKYLINK

	// get current registry revision.
	// const [registryEntry, registryReadErr] = await callModule(secureRegistryModule, "readEntry", {
	// 	publicKey: keyPair.publicKey,
	// 	dataKey: dataKey,
	// })
	// if (registryReadErr) {
	// 	throw new Error(registryReadErr)
	// }
	// log(registryEntry)

	log(resolverSkylink)
	// const resolverSkylink = "AABxLA5YgovXpREJpMLl3la7aXvADWQOSFa9LBNt9XfVnw"
	// const resolverSkylink = "EABNMkgsbEk-kesO3pxH6N5utDhvIhDyACbacQDbWFmuTw"

	// download using secureDownload
	const [{ fileData }, downloadErr] = await callModule(secureDownloadModule, "secureDownload", {
		skylink: resolverSkylink,
	})
	log(fileData.length)
	if (downloadErr) {
		log("download err")
		throw new Error(downloadErr)
	}

	// const result = unpack(fileData)
	// log(`${result}`)

	return "hello"
}

export { persistToSkynet, downloadFromSkynet }
