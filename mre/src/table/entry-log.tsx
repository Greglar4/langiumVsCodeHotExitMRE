import { ColDef, CellEditRequestEvent, GridApi } from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { useEffect, useState, useRef } from "react";
import { WebviewApi } from 'vscode-webview'
import { Model } from "../language/generated/ast";
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-quartz.css'
import './entry-log.css'

const vscode: WebviewApi<unknown> = acquireVsCodeApi()

const columnHeaderWithNewRowButtonTemplate = `<div class="ag-cell-label-container" role="presentation">
      <span data-ref="eMenu" class="ag-header-icon ag-header-cell-menu-button"></span>
      <span data-ref="eFilterButton" class="ag-header-icon ag-header-cell-filter-button"></span>
      <div data-ref="eLabel" class="ag-header-cell-label" role="presentation">
        <span class="ag-header-new-element" onclick="window.createNewRow()"></span>
        <span data-ref="eSortOrder" class="ag-header-icon ag-sort-order"></span>
        <span data-ref="eSortAsc" class="ag-header-icon ag-sort-ascending-icon"></span>
        <span data-ref="eSortDesc" class="ag-header-icon ag-sort-descending-icon"></span>
        <span data-ref="eSortNone" class="ag-header-icon ag-sort-none-icon"></span>
        <span data-ref="eText" class="ag-header-cell-text" role="columnheader"></span>
        <span data-ref="eFilter" class="ag-header-icon ag-filter-icon"></span>
      </div>
    </div>`

const columns: (ColDef)[] = [
	{
		minWidth: 300,
		flex: 1,
		headerName: 'ID',
		field: 'id',
		editable: true,
        cellDataType: 'number',
		headerComponentParams: {
			template: columnHeaderWithNewRowButtonTemplate
		}
	},
	{
		minWidth: 300,
		flex: 1,
		headerName: 'Description',
		field: 'description',
		editable: true,
        cellDataType: 'text'
	},
]

export type CommonEditAction = {
	actionIdentifier: string
	objectIdentifier: number
	newValue: string | number
	oldValue: string
	rowObjectIdentifier?: string
}


function processCellEdit(event: CellEditRequestEvent, vscode: WebviewApi<unknown>) {
	const editAction: CommonEditAction = {
		actionIdentifier: '',
		newValue: '',
		oldValue: event.oldValue,
		objectIdentifier: -1,
	}
	switch (event.colDef.field) {
		case 'id':
			editAction.objectIdentifier = event.node.data.id
			editAction.actionIdentifier = 'editId'
			editAction.newValue = event.newValue
			break
		case 'description':
			editAction.objectIdentifier = event.node.data.id
			editAction.actionIdentifier = 'editDescription'
			editAction.newValue = `'${event.newValue}'`
			break
		default:
			return
	}
	vscode.postMessage({
		command: editAction.actionIdentifier,
		editData: editAction,
	})
}

function getFreshId(api: GridApi) {
	const indexSet: number[] = []
	api.forEachNode((node) => {
		const id: number | null | undefined = api.getCellValue({colKey: 'id', rowNode: node})
		if (id !== null && id !== undefined) {
			indexSet.push(id)
		}
	})
	return indexSet.length > 0 ? Math.max(...indexSet) + 1 : 1
}

function processNewEntry(gridRef: AgGridReact | null) {
	if (!gridRef) {
		return
	}
	const editAction: CommonEditAction = {
		actionIdentifier: 'createEntry',
		newValue: 'A new Entry',
		oldValue: '',
		objectIdentifier: getFreshId(gridRef.api)
	}
	vscode.postMessage({
		command: editAction.actionIdentifier,
		editData: editAction,
	})
}

export default function EntryTable() {
    const [rowData, setRowData] = useState<object[]>([])

    useEffect(() => {
		window.addEventListener('message', (event: MessageEvent) => {
        if (event.data.type && event.data.type === 'model') {
			const model = JSON.parse(event.data.content) as Model
			const entries = model.entries
			setRowData(entries)
		}})
	}, [])

	useEffect(() => {
		vscode.postMessage({
			command: 'modelRequest',
		})
	}, [])

	const onCellEditRequest = (event: CellEditRequestEvent) => {
		processCellEdit(event, vscode)
	}

	const gridRef = useRef<AgGridReact>(null)
	const createNewRow = () => {
		processNewEntry(gridRef.current)
	}

	//@ts-expect-error
	window.createNewRow = createNewRow

    return (
		<>
			<div className={'ag-theme-quartz-dark'} style={{ height: '100%', width: '95%', position: 'absolute' }}>
				<AgGridReact
					ref={gridRef}
					rowData={rowData}
					columnDefs={columns}
					onCellEditRequest={onCellEditRequest}
					readOnlyEdit={true}
				/>
			</div>
		</>
    )
}