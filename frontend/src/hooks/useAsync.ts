import { useEffect, useState } from 'react'

export type AsyncState<T> =
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: unknown }

/**
 * Runs an async function (e.g. an API call) and tracks loading / success / error.
 *
 * @param load the function to run
 * @param key  re-run when this changes, e.g. the category or page in the URL.
 *             (Pass the values `load` uses, joined into one string.)
 */
export function useAsync<T>(load: () => Promise<T>, key: string) {
  const [state, setState] = useState<AsyncState<T>>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  // Remember which key the current state belongs to, to show "loading" as soon as the key changes.
  const [stateKey, setStateKey] = useState(key)

  if (stateKey !== key) {
    // Adjusting state during render when an input changes is the pattern React recommends
    // instead of an extra effect: https://react.dev/learn/you-might-not-need-an-effect
    setStateKey(key)
    setState({ status: 'loading' })
  }

  useEffect(() => {
    // If the user navigates on before this request finishes, ignore its result,
    // otherwise an old, slow response could overwrite a newer one (a "race condition").
    let ignore = false
    load().then(
      (data) => !ignore && setState({ status: 'success', data }),
      (error: unknown) => !ignore && setState({ status: 'error', error }),
    )
    return () => {
      ignore = true
    }
    // `load` is a new function on every render, so it is deliberately left out;
    // `key` says when the request really changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt])

  function retry() {
    setState({ status: 'loading' })
    setAttempt((current) => current + 1)
  }

  return { state, retry }
}
