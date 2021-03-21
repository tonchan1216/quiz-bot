type Contents = Array<{
  type: string
  text?: Text
  accessory?: {
    type: string
    options: Array<{
      text: Text
      description: Text
      value: string
    }>
    action_id?: string
  }
  elements?: Array<{
    type: string
    text: Text
    value: string
    action_id: string
  }>
}>

type Text = {
  type: string
  text: string
  emoji?: boolean
}

type Event = {
  queryString: string
  contentLength: number
  parameter: {
    payload: string
  }
  contextPath: string
}

function postMessage(contents: Contents, thread_ts = '') {
  const prop = PropertiesService.getScriptProperties().getProperties()
  const ACCESS_TOKEN: string = prop.ACCESS_TOKEN
  const CHANNEL_ID: string = prop.CHANNEL_ID
  const url = 'https://slack.com/api/chat.postMessage'

  // 投稿するチャンネルやメッセージ内容を入れる
  const payload = {
    token: ACCESS_TOKEN,
    channel: CHANNEL_ID,
    thread_ts: thread_ts,
    text: '',
    blocks: JSON.stringify(contents),
  }

  const params: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
    method: 'post',
    payload: payload,
  }

  // Slackに投稿
  const response = UrlFetchApp.fetch(url, params)
  return JSON.parse(response.getContentText('UTF-8'))
}

function getQuestion(): { id: string; contents: Contents } {
  const alphabet = ['A', 'B', 'C', 'D', 'E', 'F', 'G']
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('question_master')

  const lastRow: number = sheet?.getLastRow() ?? 2

  //1行目～最終行の間で、ランダムな行番号を算出する
  const row: number = Math.ceil(Math.random() * (lastRow - 1))
  //ランダムに算出した行番号のテキストを取得
  const id: string = sheet?.getRange(row, 1).getValue()
  const question: string = sheet?.getRange(row, 2).getValue()
  const selectNum: number = parseInt(sheet?.getRange(row, 5).getValue())
  const selections = sheet?.getRange(row, 6, 1, selectNum).getValues().flat() ?? []
  const options: Array<{
    text: Text
    description: Text
    value: string
  }> = selections.map((selection, index) => {
    return {
      text: {
        type: 'mrkdwn',
        text: alphabet[index],
      },
      description: {
        type: 'mrkdwn',
        text: selection,
      },
      value: alphabet[index],
    }
  })

  const contents: Contents = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: 'Today Question: No.' + id,
        emoji: true,
      },
    },
    {
      type: 'section',
      text: {
        type: 'plain_text',
        text: question,
        emoji: true,
      },
    },
    {
      type: 'divider',
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '選択肢',
      },
      accessory: {
        type: 'checkboxes',
        options: options,
        action_id: 'checkboxes',
      },
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: '解答',
            emoji: true,
          },
          value: 'submit',
          action_id: 'submit',
        },
      ],
    },
  ]

  return { id, contents }
}

function getAnswer(id: string): Contents {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('question_master')
  const ids = sheet?.getRange('A2:A').getValues().flat() ?? []

  //対象IDの問題文の行を選択
  const row: number = ids.indexOf(parseInt(id)) + 1
  const answer: string = sheet?.getRange(row, 3).getValue()
  const solution: string = sheet?.getRange(row, 4).getValue()

  const contents: Contents = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: '答え：',
      },
    },
    {
      type: 'section',
      text: {
        type: 'plain_text',
        text: answer,
      },
    },
    { type: 'divider' },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: solution,
      },
    },
  ]

  return contents
}

//毎日決まった時刻にトリガー設定させる処理
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function setTrigger() {
  const time1: Date = new Date()
  time1.setDate(time1.getDate() + 1)
  time1.setHours(12)
  time1.setMinutes(0)

  ScriptApp.newTrigger('test').timeBased().at(time1).create()
}

// 問題を投稿
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function test() {
  const { id, contents } = getQuestion()
  const response = postMessage(contents)

  if (response['ok']) {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('execution_log')
    const row: number = (sheet?.getLastRow() ?? 1) + 1
    const now: Date = new Date()

    sheet?.getRange(row, 1).setValue(now.toJSON())
    sheet?.getRange(row, 2).setValue(id)
    sheet?.getRange(row, 3).setNumberFormat('@')
    sheet?.getRange(row, 3).setValue(response['ts'])
    sheet?.getRange(row, 4).setValue('thiking')
  }
}

// 解答を投稿
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function solution() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('execution_log')
  const row: number = sheet?.getLastRow() ?? 2

  const id: string = sheet?.getRange(row, 2).getValue()
  const thread_ts: string = sheet?.getRange(row, 3).getValue()

  const contents = getAnswer(id)
  const response = postMessage(contents, thread_ts)

  if (response['ok']) {
    sheet?.getRange(row, 4).setValue('done')
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function doPost(e: Event): GoogleAppsScript.Content.TextOutput {
  // exploit JSON from payload
  const parameter = e.parameter
  const data = parameter.payload
  const json = JSON.parse(decodeURIComponent(data))

  if (json.actions[0].action_id != 'submit') {
    return ContentService.createTextOutput(JSON.stringify({ content: 'post ok' })).setMimeType(
      ContentService.MimeType.JSON
    )
  }

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('post_log')
  const row: number = (sheet?.getLastRow() ?? 1) + 1
  const now: Date = new Date()

  sheet?.getRange(row, 1).setValue(now.toJSON())
  const value: any = Object.values(json.state.values)[0]
  const selected_option = value['checkboxes']['selected_options']
  sheet?.getRange(row, 2).setValue(selected_option[0])
  sheet?.getRange(row, 3).setValue(data)

  // // reply message
  const replyMessage = {
    response_type: 'ephemeral',
    replace_original: false,
    text: 'test',
    thread_ts: json.message.ts,
  }

  const params: GoogleAppsScript.URL_Fetch.URLFetchRequestOptions = {
    method: 'post',
    payload: JSON.stringify(replyMessage),
  }

  // Slackに投稿
  const response = UrlFetchApp.fetch(json.response_url, params)

  return ContentService.createTextOutput(JSON.stringify({ content: 'post ok' })).setMimeType(
    ContentService.MimeType.JSON
  )
}
