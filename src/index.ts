import { handleMessage, addHandler, log } from "libkmodule"
import type { activeQuery } from "libkmodule"
import { v4 as uuidv4 } from "uuid"
import { persistToSkynet, downloadFromSkynet } from "./helpers"

// Values used in for identifying and using the registry
const keyPairTag = "todoListModule"
const dataKeyTag = "todoList"

interface ListItem {
	itemId: string
	label: string
	isComplete: boolean
}

// Initialized module's in-memory state
let todoList: Array<ListItem> = []

// Initialize array to hold `setUpdate` functions, one for each subscribed caller
let subscriptionUpdates: Array<(updateData: any) => void> = []

// Data initialized
let initialized = true

const hydrateFromSkynet = async () => {
	log("hydrating data")
	try {
		let persistedData = await downloadFromSkynet(keyPairTag, dataKeyTag)
		// todoList = persistedData
	} catch (err) {
		log(`Error downloading: ${err}`)
	}

	initialized = true
	pushItems()
}

const pushItems = () => {
	if (!initialized) {
		return
	}
	// for each sendUpdate function, send latest list
	subscriptionUpdates.forEach((sendUpdate) => {
		sendUpdate({ items: todoList })
	})
}

// todoList setter - methods shouldn't directly modify todoList.
const setTodoList = (updatedList: Array<ListItem>) => {
	if (!initialized) {
		return
	}
	todoList = updatedList
	pushItems()
}

// boilerplate:
// Sets up managing postMessage handling.
onmessage = handleMessage

// Define Handlers functions:

// Handle addItem method. Respond with newly created item
const handleAddItem = (aq: activeQuery) => {
	// confirm caller included a "label" field in the input
	if ("label" in aq.callerInput && typeof aq.callerInput.label === "string") {
		// create the item to add to our list
		const newItem = {
			itemId: uuidv4(), // unique identifier string
			label: aq.callerInput.label, // label from callerInput data
			isComplete: false, // defaults to incomplete
		}

		// update the state by calling the setter method
		setTodoList([...todoList, newItem])

		// respond to caller, including the added item if needed.
		aq.accept({ item: newItem })
	} else {
		// return an error if no label included in callerInput data
		aq.reject("New items require field `label`.")
	}
}

// handleGetItems will handle a call to getItems returning the list of todoItems
const handleGetItems = (aq: activeQuery) => {
	aq.accept({ items: todoList })
}

const handleUpdateItemLabel = (aq: activeQuery) => {
	// confirm caller included an "itemId" and "label" field in the input
	if (typeof aq.callerInput?.itemId === "string" && typeof aq.callerInput?.label === "string") {
		//get index of the itemId the array
		const itemIndex = todoList.findIndex(({ itemId }) => aq.callerInput.itemId === itemId)

		// if item to update found, update state, otherwise reject.
		if (itemIndex > -1) {
			let listCopy = [...todoList]
			listCopy[itemIndex] = { ...todoList[itemIndex], label: aq.callerInput.label }
			setTodoList(listCopy)

			aq.accept({ item: listCopy[itemIndex] })
		} else {
			aq.reject(`No item found with itemId ${aq.callerInput.itemId}`)
		}
	} else {
		// return an error if no label included in callerInput data
		aq.reject("Missing required field `itemId` or `label`.")
	}
}
const handleToggleCompleteItem = (aq: activeQuery) => {
	// confirm caller included an "itemId" and "label" field in the input
	if (typeof aq.callerInput?.itemId === "string") {
		//get index of the itemId the array
		const itemIndex = todoList.findIndex(({ itemId }) => aq.callerInput.itemId === itemId)

		// if item to update found, update state, otherwise reject.
		if (itemIndex > -1) {
			let listCopy = [...todoList]
			listCopy[itemIndex] = { ...todoList[itemIndex], isComplete: !todoList[itemIndex].isComplete }
			setTodoList(listCopy)

			aq.accept({ item: listCopy[itemIndex] })
		} else {
			aq.reject(`No item found with itemId ${aq.callerInput.itemId}`)
		}
	} else {
		// return an error if no label included in callerInput data
		aq.reject("Missing required field `itemId` or `label`.")
	}
}
const handleRemoveItem = (aq: activeQuery) => {
	// confirm caller included an "itemId" field in the input
	if ("itemId" in aq.callerInput && typeof aq.callerInput.itemId === "string") {
		// create list of just removed item.
		const removedItem = todoList.filter(({ itemId }) => {
			return itemId === aq.callerInput.itemId
		})

		// if item to remove found, update state, otherwise reject.
		if (removedItem.length) {
			const remainingItems = todoList.filter(({ itemId }) => {
				return itemId !== aq.callerInput.itemId
			})
			setTodoList(remainingItems)

			aq.accept({ item: removedItem[0] })
		} else {
			aq.reject(`No item found with itemId ${aq.callerInput.itemId}`)
		}
	} else {
		// return an error if no label included in callerInput data
		aq.reject("Item require field `itemId`.")
	}
}

const handleSubscribeItems = (aq: activeQuery) => {
	// add sendUpdate method to list of subscriptions
	subscriptionUpdates.push(aq.sendUpdate)

	// do initial responseUpdate for this caller
	aq.sendUpdate({ items: todoList })
}

const handleSaveToSkynet = async (aq: activeQuery) => {
	try {
		const resolverSkylink = await persistToSkynet(todoList, keyPairTag, dataKeyTag)
		log(`Persisted to ${resolverSkylink}`)
		aq.accept({})
	} catch (err) {
		aq.reject(`Saving to Skynet Failed: ${err}`)
	}
}

// Assign Handlers for exposed method names:
addHandler("addItem", handleAddItem)
addHandler("getItems", handleGetItems)
addHandler("updateItemLabel", handleUpdateItemLabel)
addHandler("toggleCompleteItem", handleToggleCompleteItem)
addHandler("removeItem", handleRemoveItem)
addHandler("subscribeItems", handleSubscribeItems)
addHandler("saveToSkynet", handleSaveToSkynet)

// hydrate on load
hydrateFromSkynet()
