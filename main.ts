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
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('question_master')

  const lastRow: number = sheet?.getLastRow() ?? 2

  //1行目～最終行の間で、ランダムな行番号を算出する
  const row: number = Math.ceil(Math.random() * (lastRow - 1))
  //ランダムに算出した行番号のテキストを取得
  const id: string = sheet?.getRange(row, 1).getValue()
  const question: string = sheet?.getRange(row, 2).getValue()

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
        options: [
          {
            text: {
              type: 'mrkdwn',
              text: '*this is mrkdwn text*',
            },
            description: {
              type: 'mrkdwn',
              text: '*this is mrkdwn text*',
            },
            value: 'value-0',
          },
          {
            text: {
              type: 'mrkdwn',
              text: '*this is mrkdwn text*',
            },
            description: {
              type: 'mrkdwn',
              text: '*this is mrkdwn text*',
            },
            value: 'value-1',
          },
          {
            text: {
              type: 'mrkdwn',
              text: '*this is mrkdwn text*',
            },
            description: {
              type: 'mrkdwn',
              text: '*this is mrkdwn text*',
            },
            value: 'value-2',
          },
        ],
        action_id: 'checkboxes-action',
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
          value: 'click_me_123',
          action_id: 'actionId-0',
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
  const row: number = ids.indexOf(parseInt(id))
  const answer: string = sheet?.getRange(row + 1, 3).getValue()

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
        text: 'This is a section block with checkboxes.',
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
